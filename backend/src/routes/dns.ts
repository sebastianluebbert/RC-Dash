import express from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { decrypt } from '../utils/encryption';
import fetch from 'node-fetch';

export const dnsRouter = express.Router();
dnsRouter.use(authenticateToken, requireAdmin);

// Get Hetzner DNS zones
dnsRouter.get('/hetzner/zones', async (req: AuthRequest, res, next) => {
  try {
    // Get API key from settings
    const settingsResult = await query(
      'SELECT value_encrypted FROM application_settings WHERE key = $1',
      ['hetzner_api_key']
    );
    
    if (settingsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hetzner API key not configured' });
    }
    
    const apiKey = decrypt(settingsResult.rows[0].value_encrypted);
    
    const response = await fetch('https://api.hetzner.cloud/v1/zones', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: 'Hetzner API error' });
    }
    
    const data: any = await response.json();
    res.json({ zones: data.zones || [] });
  } catch (error) {
    next(error);
  }
});

// Get DNS records for a zone
dnsRouter.get('/hetzner/records/:zoneId', async (req: AuthRequest, res, next) => {
  try {
    const { zoneId } = req.params;
    
    const settingsResult = await query(
      'SELECT value_encrypted FROM application_settings WHERE key = $1',
      ['hetzner_api_key']
    );
    
    if (settingsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hetzner API key not configured' });
    }
    
    const apiKey = decrypt(settingsResult.rows[0].value_encrypted);
    
    const response = await fetch(`https://api.hetzner.cloud/v1/zones/${zoneId}/records`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: 'Hetzner API error' });
    }
    
    const data: any = await response.json();
    res.json({ records: data.records || [] });
  } catch (error) {
    next(error);
  }
});

// Get AutoDNS zones
dnsRouter.get('/autodns/zones', async (req: AuthRequest, res, next) => {
  try {
    const settingsResult = await query(
      'SELECT value_encrypted FROM application_settings WHERE key = $1',
      ['autodns_credentials']
    );
    
    if (settingsResult.rows.length === 0) {
      return res.status(404).json({ error: 'AutoDNS credentials not configured' });
    }
    
    const credentials = JSON.parse(decrypt(settingsResult.rows[0].value_encrypted));
    const auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64');
    
    const response = await fetch('https://api.autodns.com/v1/zone/_search', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'X-Domainrobot-Context': credentials.context,
      },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: 'AutoDNS API error' });
    }
    
    const data: any = await response.json();
    res.json({ zones: data.data || [] });
  } catch (error) {
    next(error);
  }
});

// Get AutoDNS DNS records for a zone
dnsRouter.get('/autodns/records/:zoneName', async (req: AuthRequest, res, next) => {
  try {
    const { zoneName } = req.params;
    
    const settingsResult = await query(
      'SELECT value_encrypted FROM application_settings WHERE key = $1',
      ['autodns_credentials']
    );
    
    if (settingsResult.rows.length === 0) {
      return res.status(404).json({ error: 'AutoDNS credentials not configured' });
    }
    
    const credentials = JSON.parse(decrypt(settingsResult.rows[0].value_encrypted));
    const auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64');
    
    const response = await fetch(`https://api.autodns.com/v1/zone/${zoneName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'X-Domainrobot-Context': credentials.context,
      },
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: 'AutoDNS API error' });
    }
    
    const data: any = await response.json();
    const records = data.data?.resourceRecords || [];
    res.json({ records });
  } catch (error) {
    next(error);
  }
});

// Manage Hetzner DNS records (create, update, delete)
dnsRouter.post('/hetzner/manage', async (req: AuthRequest, res, next) => {
  try {
    const { action, zoneId, record } = req.body;
    
    if (!action || !zoneId || !record) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const settingsResult = await query(
      'SELECT value_encrypted FROM application_settings WHERE key = $1',
      ['hetzner_api_key']
    );
    
    if (settingsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hetzner API key not configured' });
    }
    
    const apiKey = decrypt(settingsResult.rows[0].value_encrypted);
    let endpoint = '';
    let method = 'POST';
    
    switch (action) {
      case 'create':
        endpoint = `https://api.hetzner.cloud/v1/zones/${zoneId}/records`;
        method = 'POST';
        break;
      case 'update':
        endpoint = `https://api.hetzner.cloud/v1/zones/${zoneId}/records/${record.id}`;
        method = 'PUT';
        break;
      case 'delete':
        endpoint = `https://api.hetzner.cloud/v1/zones/${zoneId}/records/${record.id}`;
        method = 'DELETE';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: action !== 'delete' ? JSON.stringify(record) : undefined,
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Hetzner API error' });
    }
    
    const data: any = action !== 'delete' ? await response.json() : {};
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Manage AutoDNS records (create, update, delete)
dnsRouter.post('/autodns/manage', async (req: AuthRequest, res, next) => {
  try {
    const { action, zoneName, record } = req.body;
    
    if (!action || !zoneName || !record) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const settingsResult = await query(
      'SELECT value_encrypted FROM application_settings WHERE key = $1',
      ['autodns_credentials']
    );
    
    if (settingsResult.rows.length === 0) {
      return res.status(404).json({ error: 'AutoDNS credentials not configured' });
    }
    
    const credentials = JSON.parse(decrypt(settingsResult.rows[0].value_encrypted));
    const auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64');
    
    // Get current zone data
    const zoneResponse = await fetch(`https://api.autodns.com/v1/zone/${zoneName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'X-Domainrobot-Context': credentials.context,
      },
    });
    
    if (!zoneResponse.ok) {
      return res.status(500).json({ error: 'Failed to fetch zone data' });
    }
    
    const zoneData: any = await zoneResponse.json();
    let resourceRecords = zoneData.data?.resourceRecords || [];
    
    // Modify records based on action
    switch (action) {
      case 'create':
        resourceRecords.push(record);
        break;
      case 'update':
        const updateIndex = resourceRecords.findIndex((r: any) => r.id === record.id);
        if (updateIndex !== -1) {
          resourceRecords[updateIndex] = record;
        }
        break;
      case 'delete':
        resourceRecords = resourceRecords.filter((r: any) => r.id !== record.id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Update zone with modified records
    const updateResponse = await fetch(`https://api.autodns.com/v1/zone/${zoneName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'X-Domainrobot-Context': credentials.context,
      },
      body: JSON.stringify({
        ...zoneData.data,
        resourceRecords,
      }),
    });
    
    if (!updateResponse.ok) {
      return res.status(updateResponse.status).json({ error: 'AutoDNS API error' });
    }
    
    const result: any = await updateResponse.json();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
