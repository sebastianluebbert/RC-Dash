import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { decrypt } from '../utils/encryption';
import fetch from 'node-fetch';

export const hetznerRouter = Router();

// Apply authentication middleware to all routes
hetznerRouter.use(authenticateToken);
hetznerRouter.use(requireAdmin);

// Validation schemas
const serverActionSchema = z.object({
  serverId: z.string().min(1),
  action: z.enum(['poweron', 'poweroff', 'reboot', 'reset', 'shutdown']),
});

// Helper function to get Hetzner API key
async function getHetznerApiKey(): Promise<string> {
  const result = await query(
    'SELECT value_encrypted, is_encrypted FROM application_settings WHERE key = $1',
    ['hetzner_api_key']
  );

  if (result.rows.length === 0) {
    throw new Error('Hetzner API Key not configured');
  }

  const setting = result.rows[0];
  if (setting.is_encrypted && setting.value_encrypted) {
    return decrypt(setting.value_encrypted);
  }

  throw new Error('Hetzner API Key not properly encrypted');
}

// Helper function to make Hetzner API requests
async function hetznerRequest(endpoint: string, options: any = {}) {
  const apiKey = await getHetznerApiKey();
  
  const response = await fetch(`https://api.hetzner.cloud/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Hetzner API request failed');
  }

  return response.json();
}

// Get all servers
hetznerRouter.get('/servers', async (req: AuthRequest, res) => {
  try {
    const data = await hetznerRequest('/servers');
    res.json({ servers: data.servers });
  } catch (error: any) {
    console.error('Hetzner servers error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Hetzner servers',
      details: error.message 
    });
  }
});

// Get server details
hetznerRouter.get('/servers/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = await hetznerRequest(`/servers/${id}`);
    res.json({ server: data.server });
  } catch (error: any) {
    console.error('Hetzner server details error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch server details',
      details: error.message 
    });
  }
});

// Server actions (start, stop, reboot, etc.)
hetznerRouter.post('/servers/action', async (req: AuthRequest, res) => {
  try {
    const validated = serverActionSchema.parse(req.body);
    
    const data = await hetznerRequest(`/servers/${validated.serverId}/actions/${validated.action}`, {
      method: 'POST',
    });

    res.json({ 
      success: true,
      action: data.action 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Hetzner server action error:', error);
    res.status(500).json({ 
      error: 'Failed to execute server action',
      details: error.message 
    });
  }
});

// Get server metrics
hetznerRouter.get('/servers/:id/metrics', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { type = 'cpu', start, end } = req.query;
    
    const params = new URLSearchParams({
      type: type as string,
      start: start as string,
      end: end as string,
    });

    const data = await hetznerRequest(`/servers/${id}/metrics?${params}`);
    res.json({ metrics: data.metrics });
  } catch (error: any) {
    console.error('Hetzner metrics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch server metrics',
      details: error.message 
    });
  }
});

// Get firewalls
hetznerRouter.get('/firewalls', async (req: AuthRequest, res) => {
  try {
    const data = await hetznerRequest('/firewalls');
    res.json({ firewalls: data.firewalls });
  } catch (error: any) {
    console.error('Hetzner firewalls error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch firewalls',
      details: error.message 
    });
  }
});

// Get networks
hetznerRouter.get('/networks', async (req: AuthRequest, res) => {
  try {
    const data = await hetznerRequest('/networks');
    res.json({ networks: data.networks });
  } catch (error: any) {
    console.error('Hetzner networks error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch networks',
      details: error.message 
    });
  }
});
