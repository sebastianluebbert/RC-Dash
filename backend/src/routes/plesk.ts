import express from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { encrypt, decrypt } from '../utils/encryption';
import fetch from 'node-fetch';

export const pleskRouter = express.Router();
pleskRouter.use(authenticateToken, requireAdmin);

const addServerSchema = z.object({
  name: z.string(),
  host: z.string(),
  username: z.string(),
  password: z.string(),
  port: z.number().default(8443),
  verifySsl: z.boolean().default(true),
});

// Get all Plesk servers
pleskRouter.get('/servers', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, host, port, username, verify_ssl, created_at FROM plesk_servers ORDER BY name'
    );
    res.json({ servers: result.rows });
  } catch (error) {
    next(error);
  }
});

// Add Plesk server
pleskRouter.post('/servers', async (req: AuthRequest, res, next) => {
  try {
    const serverData = addServerSchema.parse(req.body);
    
    // Normalize host
    let pleskHost = serverData.host.trim().replace(/\/+$/, '').replace(/:\d+$/, '');
    if (!pleskHost.startsWith('http://') && !pleskHost.startsWith('https://')) {
      pleskHost = `https://${pleskHost}`;
    }
    
    // Test connection
    const auth = Buffer.from(`${serverData.username}:${serverData.password}`).toString('base64');
    const testUrl = `${pleskHost}:${serverData.port}/api/v2/server`;
    
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!testResponse.ok) {
      return res.status(400).json({ 
        error: `Failed to connect to Plesk server (Status ${testResponse.status})` 
      });
    }
    
    // Encrypt password
    const passwordEncrypted = encrypt(serverData.password);
    
    const result = await query(
      `INSERT INTO plesk_servers (name, host, port, username, password_encrypted, verify_ssl, is_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, host, port, username, verify_ssl, created_at`,
      [
        serverData.name,
        pleskHost,
        serverData.port,
        serverData.username,
        passwordEncrypted,
        serverData.verifySsl,
        true,
      ]
    );
    
    res.status(201).json({ server: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Delete Plesk server
pleskRouter.delete('/servers/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM plesk_servers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get websites from a Plesk server
pleskRouter.get('/servers/:id/websites', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const serverResult = await query('SELECT * FROM plesk_servers WHERE id = $1', [id]);
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    const server = serverResult.rows[0];
    const password = decrypt(server.password_encrypted);
    const auth = Buffer.from(`${server.username}:${password}`).toString('base64');
    
    const response = await fetch(`${server.host}:${server.port}/api/v2/domains`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: 'Plesk API error' });
    }
    
    const data: any = await response.json();
    res.json({ websites: data || [] });
  } catch (error) {
    next(error);
  }
});
