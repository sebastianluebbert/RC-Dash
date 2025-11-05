import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../database/pool';
import { decrypt } from '../utils/encryption';
import fetch from 'node-fetch';

export const scriptsRouter = Router();

// Apply authentication middleware
scriptsRouter.use(authenticateToken);
scriptsRouter.use(requireAdmin);

// Validation schema
const executeScriptSchema = z.object({
  node: z.string().min(1).max(255),
  vmid: z.number().int().positive(),
  scriptUrl: z.string().url(),
  scriptName: z.string().min(1).max(255),
});

// Helper function to authenticate with Proxmox
async function authenticateProxmox(node: string) {
  const nodeResult = await query(
    'SELECT host, port, username, password_encrypted, realm FROM proxmox_nodes WHERE name = $1',
    [node]
  );

  if (nodeResult.rows.length === 0) {
    throw new Error('Proxmox node not found');
  }

  const nodeConfig = nodeResult.rows[0];
  const password = decrypt(nodeConfig.password_encrypted);

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
  
  return {
    config: nodeConfig,
    ticket: authData.data.ticket,
    csrfToken: authData.data.CSRFPreventionToken,
  };
}

// Execute script on VM/Container
scriptsRouter.post('/execute', async (req: AuthRequest, res) => {
  try {
    const validated = executeScriptSchema.parse(req.body);
    const { node, vmid, scriptUrl, scriptName } = validated;

    // Authenticate with Proxmox
    const { config, ticket, csrfToken } = await authenticateProxmox(node);

    // Determine if it's a VM or Container
    let resourceType = 'qemu';
    let statusResponse = await fetch(
      `${config.host}:${config.port}/api2/json/nodes/${node}/qemu/${vmid}/status/current`,
      {
        headers: {
          'Cookie': `PVEAuthCookie=${ticket}`,
        },
      }
    );

    if (!statusResponse.ok) {
      // Try LXC
      statusResponse = await fetch(
        `${config.host}:${config.port}/api2/json/nodes/${node}/lxc/${vmid}/status/current`,
        {
          headers: {
            'Cookie': `PVEAuthCookie=${ticket}`,
          },
        }
      );
      
      if (statusResponse.ok) {
        resourceType = 'lxc';
      } else {
        throw new Error('VM/Container not found');
      }
    }

    // Execute script via agent
    const executeCommand = `bash -c "$(wget -qLO - ${scriptUrl})"`;
    
    const execResponse = await fetch(
      `${config.host}:${config.port}/api2/json/nodes/${node}/${resourceType}/${vmid}/agent/exec`,
      {
        method: 'POST',
        headers: {
          'Cookie': `PVEAuthCookie=${ticket}`,
          'CSRFPreventionToken': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: ['/bin/bash', '-c', executeCommand],
        }),
      }
    );

    if (!execResponse.ok) {
      throw new Error('Failed to execute script');
    }

    const execData: any = await execResponse.json();

    res.json({
      success: true,
      message: `Script "${scriptName}" is being executed`,
      pid: execData.data?.pid,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Script execution error:', error);
    res.status(500).json({ 
      error: 'Failed to execute script',
      details: error.message 
    });
  }
});

// Get available helper scripts
scriptsRouter.get('/available', async (req: AuthRequest, res) => {
  try {
    // Return a list of commonly used helper scripts
    const scripts = [
      {
        id: 'docker-install',
        name: 'Install Docker',
        description: 'Installs Docker Engine and Docker Compose',
        url: 'https://get.docker.com',
        category: 'containers',
      },
      {
        id: 'nginx-install',
        name: 'Install Nginx',
        description: 'Installs and configures Nginx web server',
        url: 'https://raw.githubusercontent.com/tteck/Proxmox/main/ct/nginx.sh',
        category: 'webserver',
      },
      {
        id: 'update-system',
        name: 'System Update',
        description: 'Updates all packages and the system',
        url: 'https://raw.githubusercontent.com/tteck/Proxmox/main/misc/update.sh',
        category: 'system',
      },
      {
        id: 'portainer',
        name: 'Install Portainer',
        description: 'Installs Portainer for Docker management',
        url: 'https://raw.githubusercontent.com/tteck/Proxmox/main/ct/portainer.sh',
        category: 'containers',
      },
    ];

    res.json({ scripts });
  } catch (error: any) {
    console.error('Available scripts error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available scripts',
      details: error.message 
    });
  }
});
