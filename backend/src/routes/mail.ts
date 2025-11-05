import express from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { encrypt, decrypt } from '../utils/encryption';
import fetch from 'node-fetch';

export const mailRouter = express.Router();
mailRouter.use(authenticateToken, requireAdmin);

const addServerSchema = z.object({
  name: z.string(),
  host: z.string(),
  apiKey: z.string(),
  verifySsl: z.boolean().default(true),
});

// Get all Mailcow servers
mailRouter.get('/servers', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, host, verify_ssl, created_at FROM mailcow_servers ORDER BY name'
    );
    res.json({ servers: result.rows });
  } catch (error) {
    next(error);
  }
});

// Add Mailcow server
mailRouter.post('/servers', async (req: AuthRequest, res, next) => {
  try {
    const serverData = addServerSchema.parse(req.body);
    
    // Test connection first
    const testResponse = await fetch(`${serverData.host}/api/v1/get/mailbox/all`, {
      headers: {
        'X-API-Key': serverData.apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!testResponse.ok) {
      return res.status(400).json({ error: 'Failed to connect to Mailcow API' });
    }
    
    // Encrypt API key
    const apiKeyEncrypted = encrypt(serverData.apiKey);
    
    const result = await query(
      `INSERT INTO mailcow_servers (name, host, api_key_encrypted, verify_ssl, is_encrypted)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (host) DO UPDATE SET
         name = EXCLUDED.name,
         api_key_encrypted = EXCLUDED.api_key_encrypted,
         verify_ssl = EXCLUDED.verify_ssl
       RETURNING id, name, host, verify_ssl, created_at`,
      [serverData.name, serverData.host, apiKeyEncrypted, serverData.verifySsl, true]
    );
    
    res.status(201).json({ server: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Delete Mailcow server
mailRouter.delete('/servers/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM mailcow_servers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get mailboxes from a server
mailRouter.get('/servers/:id/mailboxes', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const serverResult = await query('SELECT * FROM mailcow_servers WHERE id = $1', [id]);
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    const server = serverResult.rows[0];
    const apiKey = decrypt(server.api_key_encrypted);
    
    const response = await fetch(`${server.host}/api/v1/get/mailbox/all`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: 'Mailcow API error' });
    }
    
    const data: any = await response.json();
    res.json({ mailboxes: data || [] });
  } catch (error) {
    next(error);
  }
});
