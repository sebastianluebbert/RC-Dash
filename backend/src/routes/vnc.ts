import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { decrypt } from '../utils/encryption';
import fetch from 'node-fetch';

export const vncRouter = Router();

// Apply authentication middleware
vncRouter.use(authenticateToken);

// Validation schema
const vncRequestSchema = z.object({
  node: z.string().min(1).max(255),
  vmid: z.number().int().positive(),
});

// Get VNC ticket for VM/Container
vncRouter.post('/ticket', async (req: AuthRequest, res) => {
  try {
    const validated = vncRequestSchema.parse(req.body);
    const { node, vmid } = validated;

    // Get Proxmox node configuration
    const nodeResult = await query(
      'SELECT host, port, username, password_encrypted, realm FROM proxmox_nodes WHERE name = $1',
      [node]
    );

    if (nodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proxmox node not found' });
    }

    const nodeConfig = nodeResult.rows[0];
    const password = decrypt(nodeConfig.password_encrypted);

    // Authenticate with Proxmox
    const authResponse = await fetch(
      `${nodeConfig.host}:${nodeConfig.port}/api2/json/access/ticket`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: nodeConfig.username,
          password: password,
          realm: nodeConfig.realm,
        }),
      }
    );

    if (!authResponse.ok) {
      throw new Error('Proxmox authentication failed');
    }

    const authData: any = await authResponse.json();
    const ticket = authData.data.ticket;
    const csrfToken = authData.data.CSRFPreventionToken;

    // Check if it's a VM or Container
    const statusResponse = await fetch(
      `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/qemu/${vmid}/status/current`,
      {
        headers: {
          'Cookie': `PVEAuthCookie=${ticket}`,
          'CSRFPreventionToken': csrfToken,
        },
      }
    );

    const isVM = statusResponse.ok;
    const resourceType = isVM ? 'qemu' : 'lxc';

    // Get VNC WebSocket info
    const vncResponse = await fetch(
      `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/${resourceType}/${vmid}/vncwebsocket`,
      {
        method: 'POST',
        headers: {
          'Cookie': `PVEAuthCookie=${ticket}`,
          'CSRFPreventionToken': csrfToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!vncResponse.ok) {
      throw new Error('Failed to get VNC websocket');
    }

    const vncData: any = await vncResponse.json();

    res.json({
      ticket: ticket,
      port: vncData.data.port,
      upid: vncData.data.upid,
      node: node,
      vmid: vmid,
      vncwebsocket: vncData.data,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('VNC ticket error:', error);
    res.status(500).json({ 
      error: 'Failed to get VNC ticket',
      details: error.message 
    });
  }
});

// Get VNC proxy configuration
vncRouter.get('/proxy/:node/:vmid', async (req: AuthRequest, res) => {
  try {
    const { node, vmid } = req.params;
    
    const validated = vncRequestSchema.parse({
      node,
      vmid: parseInt(vmid),
    });

    // Get Proxmox node configuration
    const nodeResult = await query(
      'SELECT host, port FROM proxmox_nodes WHERE name = $1',
      [validated.node]
    );

    if (nodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proxmox node not found' });
    }

    const nodeConfig = nodeResult.rows[0];

    res.json({
      host: nodeConfig.host.replace('https://', '').replace('http://', ''),
      port: nodeConfig.port,
      node: validated.node,
      vmid: validated.vmid,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('VNC proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to get VNC proxy configuration',
      details: error.message 
    });
  }
});
