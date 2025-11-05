import apiClient from '@/lib/api-client';

export interface ProxmoxNode {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  realm: string;
  verify_ssl: boolean;
  created_at: string;
}

export interface Server {
  id: string;
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
  cpu_usage?: number;
  memory_usage?: number;
  memory_total?: number;
  disk_usage?: number;
  disk_total?: number;
  uptime?: number;
}

export const proxmoxService = {
  // Nodes management
  async getNodes(): Promise<ProxmoxNode[]> {
    const response = await apiClient.get('/proxmox/nodes');
    return response.data.nodes;
  },

  async addNode(node: {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    realm: string;
    verify_ssl: boolean;
  }) {
    const response = await apiClient.post('/proxmox/nodes', node);
    return response.data;
  },

  async deleteNode(id: string) {
    const response = await apiClient.delete(`/proxmox/nodes/${id}`);
    return response.data;
  },

  // Resources management
  async getResources(): Promise<{ servers: Server[] }> {
    const response = await apiClient.get('/proxmox/resources');
    return response.data;
  },

  async controlVM(vmid: number, node: string, type: 'qemu' | 'lxc', action: 'start' | 'stop' | 'reboot' | 'shutdown') {
    const response = await apiClient.post('/proxmox/control', { vmid, node, type, action });
    return response.data;
  },

  async createLXC(data: any) {
    const response = await apiClient.post('/proxmox/lxc/create', data);
    return response.data;
  },

  async createVM(data: any) {
    const response = await apiClient.post('/proxmox/vm/create', data);
    return response.data;
  },

  // VNC Management
  async getVNCTicket(node: string, vmid: number, type: 'qemu' | 'lxc') {
    const response = await apiClient.post('/proxmox/vnc/ticket', { node, vmid, type });
    return response.data;
  },

  // Script Execution
  async executeScript(node: string, scriptUrl: string, scriptName: string) {
    const response = await apiClient.post('/proxmox/execute-script', {
      node,
      scriptUrl,
      scriptName,
    });
    return response.data;
  },
};
