import express from 'express';
import { z } from 'zod';
import { query } from '../database/pool';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '../utils/encryption';
import fetch from 'node-fetch';

export const proxmoxRouter = express.Router();

// All Proxmox routes require authentication and admin rights
proxmoxRouter.use(authenticateToken, requireAdmin);

const addNodeSchema = z.object({
  name: z.string(),
  host: z.string().url(),
  port: z.number().default(8006),
  username: z.string(),
  password: z.string(),
  realm: z.string().default('pam'),
});

// Get all Proxmox nodes
proxmoxRouter.get('/nodes', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, host, port, username, realm, verify_ssl, created_at FROM proxmox_nodes ORDER BY name'
    );
    res.json({ nodes: result.rows });
  } catch (error) {
    next(error);
  }
});

// Add Proxmox node
proxmoxRouter.post('/nodes', async (req: AuthRequest, res, next) => {
  try {
    const nodeData = addNodeSchema.parse(req.body);
    
    // Encrypt password
    const passwordEncrypted = encrypt(nodeData.password);
    
    const result = await query(
      `INSERT INTO proxmox_nodes (name, host, port, username, password_encrypted, realm, verify_ssl, is_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, host, port, username, realm, verify_ssl, created_at`,
      [
        nodeData.name,
        nodeData.host,
        nodeData.port,
        nodeData.username,
        passwordEncrypted,
        nodeData.realm,
        false,
        true,
      ]
    );
    
    res.status(201).json({ node: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Delete Proxmox node
proxmoxRouter.delete('/nodes/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM proxmox_nodes WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json({ message: 'Node deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get Proxmox resources (VMs/Containers)
proxmoxRouter.get('/resources', async (req: AuthRequest, res, next) => {
  try {
    // Get all nodes
    const nodesResult = await query('SELECT * FROM proxmox_nodes');
    const nodes = nodesResult.rows;
    
    if (nodes.length === 0) {
      return res.json({ servers: [], synced: 0 });
    }
    
    const allVMs: any[] = [];
    
    // Process each node
    for (const node of nodes) {
      try {
        const password = decrypt(node.password_encrypted);
        
        // Get auth ticket
        const authResponse = await fetch(`${node.host}/api2/json/access/ticket`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            username: node.username,
            password: password,
          }).toString(),
        });
        
        if (!authResponse.ok) {
          console.error(`Auth failed for node ${node.name}`);
          continue;
        }
        
        const authData: any = await authResponse.json();
        const ticket = authData.data.ticket;
        
        // Get cluster resources
        const resourcesResponse = await fetch(`${node.host}/api2/json/cluster/resources`, {
          headers: { 'Cookie': `PVEAuthCookie=${ticket}` },
        });
        
        if (!resourcesResponse.ok) {
          console.error(`Failed to fetch resources from ${node.name}`);
          continue;
        }
        
        const resourcesData: any = await resourcesResponse.json();
        const resources = resourcesData.data || [];
        
        const nodeVMs = resources.filter((r: any) => 
          (r.type === 'qemu' || r.type === 'lxc') && r.node === node.name
        );
        
        allVMs.push(...nodeVMs);
      } catch (error) {
        console.error(`Error processing node ${node.name}:`, error);
      }
    }
    
    // Sync to database
    for (const vm of allVMs) {
      const serverData = {
        vmid: vm.vmid,
        name: vm.name || `VM-${vm.vmid}`,
        node: vm.node,
        type: vm.type,
        status: vm.status,
        cpu_usage: vm.cpu ? vm.cpu * 100 : null,
        memory_usage: vm.mem ? Math.round(vm.mem / 1024 / 1024) : null,
        memory_total: vm.maxmem ? Math.round(vm.maxmem / 1024 / 1024) : null,
        disk_usage: vm.disk ? Math.round(vm.disk / 1024 / 1024 / 1024) : null,
        disk_total: vm.maxdisk ? Math.round(vm.maxdisk / 1024 / 1024 / 1024) : null,
        uptime: vm.uptime || null,
      };
      
      // Upsert server
      await query(
        `INSERT INTO servers (vmid, name, node, type, status, cpu_usage, memory_usage, memory_total, disk_usage, disk_total, uptime, last_sync)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (vmid, node) 
         DO UPDATE SET
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           cpu_usage = EXCLUDED.cpu_usage,
           memory_usage = EXCLUDED.memory_usage,
           memory_total = EXCLUDED.memory_total,
           disk_usage = EXCLUDED.disk_usage,
           disk_total = EXCLUDED.disk_total,
           uptime = EXCLUDED.uptime,
           last_sync = NOW()`,
        [
          serverData.vmid,
          serverData.name,
          serverData.node,
          serverData.type,
          serverData.status,
          serverData.cpu_usage,
          serverData.memory_usage,
          serverData.memory_total,
          serverData.disk_usage,
          serverData.disk_total,
          serverData.uptime,
        ]
      );
    }
    
    // Return all servers from DB
    const serversResult = await query('SELECT * FROM servers ORDER BY vmid');
    
    res.json({
      success: true,
      servers: serversResult.rows,
      synced: allVMs.length,
    });
  } catch (error) {
    next(error);
  }
});

// VM/Container control (start, stop, reboot, shutdown)
proxmoxRouter.post('/control', async (req: AuthRequest, res, next) => {
  try {
    const { node, vmid, type, action } = req.body;
    
    if (!['start', 'stop', 'shutdown', 'reboot'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Get node config
    const nodeResult = await query('SELECT * FROM proxmox_nodes WHERE name = $1', [node]);
    if (nodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    const nodeConfig = nodeResult.rows[0];
    const password = decrypt(nodeConfig.password_encrypted);
    
    // Auth
    const authResponse = await fetch(`${nodeConfig.host}/api2/json/access/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: nodeConfig.username,
        password: password,
      }).toString(),
    });
    
    if (!authResponse.ok) {
      return res.status(500).json({ error: 'Proxmox authentication failed' });
    }
    
    const authData: any = await authResponse.json();
    const ticket = authData.data.ticket;
    const csrfToken = authData.data.CSRFPreventionToken;
    
    // Execute action
    const actionEndpoint = type === 'qemu'
      ? `${nodeConfig.host}/api2/json/nodes/${node}/qemu/${vmid}/status/${action}`
      : `${nodeConfig.host}/api2/json/nodes/${node}/lxc/${vmid}/status/${action}`;
    
    const actionResponse = await fetch(actionEndpoint, {
      method: 'POST',
      headers: {
        'Cookie': `PVEAuthCookie=${ticket}`,
        'CSRFPreventionToken': csrfToken,
      },
    });
    
    if (!actionResponse.ok) {
      return res.status(500).json({ error: `Failed to ${action} ${type}` });
    }
    
    const result: any = await actionResponse.json();
    
    res.json({
      success: true,
      action,
      vmid,
      type,
      node,
      upid: result.data,
    });
  } catch (error) {
    next(error);
  }
});

// Create LXC Container
const createLXCSchema = z.object({
  node: z.string().min(1).max(255),
  vmid: z.number().int().positive(),
  hostname: z.string().min(1).max(255),
  password: z.string().min(6),
  ostemplate: z.string().min(1),
  storage: z.string().default('local-lvm'),
  cores: z.number().int().positive().default(1),
  memory: z.number().int().positive().default(512),
  swap: z.number().int().nonnegative().default(512),
  disk: z.number().int().positive().default(8),
  net0: z.string().default('name=eth0,bridge=vmbr0,ip=dhcp'),
  unprivileged: z.boolean().default(true),
  start: z.boolean().default(true),
});

proxmoxRouter.post('/lxc/create', async (req: AuthRequest, res, next) => {
  try {
    const validated = createLXCSchema.parse(req.body);
    const { node, ...lxcConfig } = validated;

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

    // Create LXC container
    const createResponse = await fetch(
      `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/lxc`,
      {
        method: 'POST',
        headers: {
          'Cookie': `PVEAuthCookie=${authData.data.ticket}`,
          'CSRFPreventionToken': authData.data.CSRFPreventionToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          vmid: lxcConfig.vmid.toString(),
          hostname: lxcConfig.hostname,
          password: lxcConfig.password,
          ostemplate: lxcConfig.ostemplate,
          storage: lxcConfig.storage,
          cores: lxcConfig.cores.toString(),
          memory: lxcConfig.memory.toString(),
          swap: lxcConfig.swap.toString(),
          rootfs: `${lxcConfig.storage}:${lxcConfig.disk}`,
          net0: lxcConfig.net0,
          unprivileged: lxcConfig.unprivileged ? '1' : '0',
          start: lxcConfig.start ? '1' : '0',
        }),
      }
    );

    if (!createResponse.ok) {
      const errorData: any = await createResponse.json();
      throw new Error(errorData.errors || 'Failed to create LXC container');
    }

    const createData: any = await createResponse.json();

    res.json({
      success: true,
      message: 'LXC container creation started',
      taskId: createData.data,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    next(error);
  }
});

// Create VM
const createVMSchema = z.object({
  node: z.string().min(1).max(255),
  vmid: z.number().int().positive(),
  name: z.string().min(1).max(255),
  memory: z.number().int().positive().default(2048),
  cores: z.number().int().positive().default(2),
  sockets: z.number().int().positive().default(1),
  disk: z.number().int().positive().default(32),
  storage: z.string().default('local-lvm'),
  iso: z.string().min(1),
  net0: z.string().default('virtio,bridge=vmbr0'),
  ostype: z.string().default('l26'),
  start: z.boolean().default(false),
});

proxmoxRouter.post('/vm/create', async (req: AuthRequest, res, next) => {
  try {
    const validated = createVMSchema.parse(req.body);
    const { node, ...vmConfig } = validated;

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

    // Create VM
    const createResponse = await fetch(
      `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/qemu`,
      {
        method: 'POST',
        headers: {
          'Cookie': `PVEAuthCookie=${authData.data.ticket}`,
          'CSRFPreventionToken': authData.data.CSRFPreventionToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          vmid: vmConfig.vmid.toString(),
          name: vmConfig.name,
          memory: vmConfig.memory.toString(),
          cores: vmConfig.cores.toString(),
          sockets: vmConfig.sockets.toString(),
          scsi0: `${vmConfig.storage}:${vmConfig.disk}`,
          ide2: `${vmConfig.iso},media=cdrom`,
          net0: vmConfig.net0,
          ostype: vmConfig.ostype,
          boot: 'order=scsi0;ide2',
        }),
      }
    );

    if (!createResponse.ok) {
      const errorData: any = await createResponse.json();
      throw new Error(errorData.errors || 'Failed to create VM');
    }

    const createData: any = await createResponse.json();

    // Start VM if requested
    if (vmConfig.start) {
      await fetch(
        `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/qemu/${vmConfig.vmid}/status/start`,
        {
          method: 'POST',
          headers: {
            'Cookie': `PVEAuthCookie=${authData.data.ticket}`,
            'CSRFPreventionToken': authData.data.CSRFPreventionToken,
          },
        }
      );
    }

    res.json({
      success: true,
      message: 'VM creation started',
      taskId: createData.data,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    next(error);
  }
});

// Get VNC ticket
const vncTicketSchema = z.object({
  node: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_.]+$/),
  vmid: z.number().int().positive(),
  type: z.enum(['qemu', 'lxc']),
});

proxmoxRouter.post('/vnc/ticket', async (req: AuthRequest, res, next) => {
  try {
    const validated = vncTicketSchema.parse(req.body);
    const { node, vmid, type } = validated;

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

    // Get VNC ticket
    const vncEndpoint = type === 'qemu'
      ? `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/qemu/${vmid}/vncproxy`
      : `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/lxc/${vmid}/vncproxy`;

    const vncResponse = await fetch(vncEndpoint, {
      method: 'POST',
      headers: {
        'Cookie': `PVEAuthCookie=${authData.data.ticket}`,
        'CSRFPreventionToken': authData.data.CSRFPreventionToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        websocket: '1',
      }),
    });

    if (!vncResponse.ok) {
      throw new Error('Failed to get VNC ticket');
    }

    const vncData: any = await vncResponse.json();

    // Construct WebSocket URL
    const wsProtocol = nodeConfig.host.startsWith('https://') ? 'wss://' : 'ws://';
    const hostWithoutProtocol = nodeConfig.host.replace('https://', '').replace('http://', '');
    const wsUrl = `${wsProtocol}${hostWithoutProtocol}:${nodeConfig.port}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${vncData.data.port}&vncticket=${encodeURIComponent(vncData.data.ticket)}`;

    res.json({
      success: true,
      ticket: vncData.data.ticket,
      port: vncData.data.port,
      wsUrl: wsUrl,
      upid: vncData.data.upid,
      csrfToken: authData.data.CSRFPreventionToken,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    next(error);
  }
});

// Execute helper script
const ALLOWED_SCRIPT_DOMAINS = [
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
];

const executeScriptSchema = z.object({
  node: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_.]+$/),
  scriptUrl: z.string().url().refine(
    (url) => {
      try {
        const domain = new URL(url).hostname;
        return ALLOWED_SCRIPT_DOMAINS.includes(domain);
      } catch {
        return false;
      }
    },
    { message: `Script URL must be from allowed domains: ${ALLOWED_SCRIPT_DOMAINS.join(', ')}` }
  ),
  scriptName: z.string().min(1).max(100),
});

proxmoxRouter.post('/execute-script', async (req: AuthRequest, res, next) => {
  try {
    const validated = executeScriptSchema.parse(req.body);
    const { node, scriptUrl, scriptName } = validated;

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

    console.log(`Executing helper script ${scriptName} on node ${node}`);

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

    // Execute the script via Proxmox API
    const command = `bash -c "$(wget -qLO - ${scriptUrl})"`;

    const executeResponse = await fetch(
      `${nodeConfig.host}:${nodeConfig.port}/api2/json/nodes/${node}/execute`,
      {
        method: 'POST',
        headers: {
          'Cookie': `PVEAuthCookie=${authData.data.ticket}`,
          'CSRFPreventionToken': authData.data.CSRFPreventionToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          commands: command,
        }),
      }
    );

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error('Script execution failed:', errorText);
      throw new Error(`Failed to execute script: ${executeResponse.status}`);
    }

    const executeData: any = await executeResponse.json();
    console.log(`Script execution started successfully`);

    res.json({
      success: true,
      message: `Script ${scriptName} wird ausgeführt`,
      data: executeData.data,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    next(error);
  }
});
