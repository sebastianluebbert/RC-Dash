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
async function hetznerRequest(endpoint: string, options: any = {}): Promise<any> {
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
    const error: any = await response.json();
    throw new Error(error.error?.message || 'Hetzner API request failed');
  }

  return response.json();
}

// Get all servers
hetznerRouter.get('/servers', async (req: AuthRequest, res) => {
  try {
    const data: any = await hetznerRequest('/servers');
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
    const data: any = await hetznerRequest(`/servers/${id}`);
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
    
    const data: any = await hetznerRequest(`/servers/${validated.serverId}/actions/${validated.action}`, {
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

    const data: any = await hetznerRequest(`/servers/${id}/metrics?${params}`);
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
    const data: any = await hetznerRequest('/firewalls');
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
    const data: any = await hetznerRequest('/networks');
    res.json({ networks: data.networks });
  } catch (error: any) {
    console.error('Hetzner networks error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch networks',
      details: error.message 
    });
  }
});

// Manage networks (create, update, delete, attach, detach)
hetznerRouter.post('/networks/manage', async (req: AuthRequest, res) => {
  try {
    const { action, networkId, serverId, ...networkData } = req.body;

    let endpoint = '';
    let method = 'POST';
    let requestBody: any = {};

    if (action === 'create') {
      endpoint = '/networks';
      requestBody = networkData;
    } else if (action === 'attach') {
      endpoint = `/networks/${networkId}/actions/attach_to_server`;
      requestBody = { server: serverId, ...networkData };
    } else if (action === 'detach') {
      endpoint = `/networks/${networkId}/actions/detach_from_server`;
      requestBody = { server: serverId };
    } else if (action === 'delete') {
      endpoint = `/networks/${networkId}`;
      method = 'DELETE';
    } else if (action === 'update') {
      endpoint = `/networks/${networkId}`;
      method = 'PUT';
      requestBody = networkData;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const data: any = await hetznerRequest(endpoint, {
      method,
      ...(method !== 'DELETE' && { body: JSON.stringify(requestBody) }),
    });

    res.json(data);
  } catch (error: any) {
    console.error('Hetzner network management error:', error);
    res.status(500).json({ 
      error: 'Failed to manage network',
      details: error.message 
    });
  }
});

// Manage firewalls (create, update, delete, attach, detach)
hetznerRouter.post('/firewalls/manage', async (req: AuthRequest, res) => {
  try {
    const { action, firewallId, serverId, ...firewallData } = req.body;

    let endpoint = '';
    let method = 'POST';
    let requestBody: any = {};

    if (action === 'create') {
      endpoint = '/firewalls';
      requestBody = firewallData;
    } else if (action === 'attach') {
      endpoint = `/firewalls/${firewallId}/actions/apply_to_resources`;
      requestBody = { apply_to: [{ type: 'server', server: serverId }] };
    } else if (action === 'detach') {
      endpoint = `/firewalls/${firewallId}/actions/remove_from_resources`;
      requestBody = { remove_from: [{ type: 'server', server: serverId }] };
    } else if (action === 'delete') {
      endpoint = `/firewalls/${firewallId}`;
      method = 'DELETE';
    } else if (action === 'update') {
      endpoint = `/firewalls/${firewallId}`;
      method = 'PUT';
      requestBody = firewallData;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const data: any = await hetznerRequest(endpoint, {
      method,
      ...(method !== 'DELETE' && { body: JSON.stringify(requestBody) }),
    });

    res.json(data);
  } catch (error: any) {
    console.error('Hetzner firewall management error:', error);
    res.status(500).json({ 
      error: 'Failed to manage firewall',
      details: error.message 
    });
  }
});

// Get DNS zones
hetznerRouter.get('/dns/zones', async (req: AuthRequest, res) => {
  try {
    const data: any = await hetznerRequest('/zones');
    res.json({ zones: data.zones || [] });
  } catch (error: any) {
    console.error('Hetzner DNS zones error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch DNS zones',
      details: error.message 
    });
  }
});

// Get DNS records for a zone
hetznerRouter.get('/dns/zones/:zoneId/records', async (req: AuthRequest, res) => {
  try {
    const { zoneId } = req.params;
    const data: any = await hetznerRequest(`/zones/${zoneId}/rrsets`);
    res.json({ records: data.rrsets || [] });
  } catch (error: any) {
    console.error('Hetzner DNS records error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch DNS records',
      details: error.message 
    });
  }
});

// Manage DNS records (create, update, delete)
const dnsManageSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  zoneId: z.string().min(1),
  rrsetId: z.string().optional(),
  record: z.object({
    name: z.string(),
    type: z.string(),
    ttl: z.number().positive().optional(),
    value: z.string(),
  }).optional(),
});

hetznerRouter.post('/dns/manage', async (req: AuthRequest, res) => {
  try {
    const validated = dnsManageSchema.parse(req.body);
    const { action, zoneId, rrsetId, record } = validated;

    let endpoint = '';
    let method = 'POST';
    let requestBody: any = {};

    switch (action) {
      case 'create':
        if (!record) {
          return res.status(400).json({ error: 'record is required for create action' });
        }
        endpoint = `/zones/${zoneId}/rrsets`;
        requestBody = {
          name: record.name,
          type: record.type,
          ttl: record.ttl || 3600,
          records: [{ value: record.value }],
        };
        break;

      case 'update':
        if (!rrsetId || !record) {
          return res.status(400).json({ error: 'rrsetId and record are required for update action' });
        }
        endpoint = `/zones/${zoneId}/rrsets/${rrsetId}`;
        method = 'PUT';
        requestBody = {
          name: record.name,
          type: record.type,
          ttl: record.ttl || 3600,
          records: [{ value: record.value }],
        };
        break;

      case 'delete':
        if (!rrsetId) {
          return res.status(400).json({ error: 'rrsetId is required for delete action' });
        }
        endpoint = `/zones/${zoneId}/rrsets/${rrsetId}`;
        method = 'DELETE';
        break;
    }

    const data: any = await hetznerRequest(endpoint, {
      method,
      ...(method !== 'DELETE' && { body: JSON.stringify(requestBody) }),
    });

    res.json(data);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Hetzner DNS management error:', error);
    res.status(500).json({ 
      error: 'Failed to manage DNS record',
      details: error.message 
    });
  }
});
