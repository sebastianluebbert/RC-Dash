import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { decrypt } from '../utils/encryption';

export const ufwRouter = Router();

// Apply authentication middleware to all routes
ufwRouter.use(authenticateToken);
ufwRouter.use(requireAdmin);

// Validation schema
const requestSchema = z.object({
  serverId: z.string().uuid(),
  action: z.enum(['status', 'enable', 'disable', 'list', 'add', 'delete', 'reset']),
  rule: z.string().optional(),
  port: z.string().optional(),
  protocol: z.enum(['tcp', 'udp', 'any']).optional(),
  from: z.string().ip().optional(),
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

// Manage UFW firewall
ufwRouter.post('/manage', async (req: AuthRequest, res) => {
  try {
    const validated = requestSchema.parse(req.body);
    const { serverId, action, rule, port, protocol, from } = validated;

    const apiKey = await getHetznerApiKey();

    // Get server details
    const response = await fetch(`https://api.hetzner.cloud/v1/servers/${serverId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get server details: ${response.status}`);
    }

    const serverData: any = await response.json();
    const serverIp = serverData.server.public_net.ipv4.ip;

    // Build UFW command based on action
    let ufwCommand = '';
    
    switch (action) {
      case 'status':
        ufwCommand = 'sudo ufw status numbered';
        break;
      case 'enable':
        ufwCommand = 'sudo ufw --force enable';
        break;
      case 'disable':
        ufwCommand = 'sudo ufw disable';
        break;
      case 'list':
        ufwCommand = 'sudo ufw status verbose';
        break;
      case 'add':
        if (!port || !protocol) {
          return res.status(400).json({ error: 'Port and protocol required for adding rule' });
        }
        if (from) {
          ufwCommand = `sudo ufw allow from ${from} to any port ${port} proto ${protocol}`;
        } else {
          ufwCommand = `sudo ufw allow ${port}/${protocol}`;
        }
        break;
      case 'delete':
        if (!rule) {
          return res.status(400).json({ error: 'Rule number required for deletion' });
        }
        ufwCommand = `sudo ufw --force delete ${rule}`;
        break;
      case 'reset':
        ufwCommand = 'sudo ufw --force reset';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    console.log(`UFW command prepared for ${serverIp}: ${ufwCommand}`);

    // Note: This is a placeholder. In production, you would:
    // 1. Use SSH library to connect to the server
    // 2. Execute the UFW command
    // 3. Return the output
    
    res.json({
      success: true,
      message: `UFW command prepared for execution`,
      command: ufwCommand,
      server: serverIp,
      note: 'SSH execution requires server credentials and SSH library integration'
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('UFW management error:', error);
    res.status(500).json({ 
      error: 'Failed to manage UFW',
      details: error.message 
    });
  }
});
