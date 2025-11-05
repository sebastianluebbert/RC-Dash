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
