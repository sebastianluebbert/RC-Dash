import apiClient from '@/lib/api-client';

export interface VNCTicket {
  ticket: string;
  port: number;
  wsUrl: string;
  upid: string;
  csrfToken: string;
}

export const vncService = {
  async getTicket(node: string, vmid: number, type: 'qemu' | 'lxc'): Promise<VNCTicket> {
    const response = await apiClient.post('/proxmox/vnc/ticket', {
      node,
      vmid,
      type,
    });
    return response.data;
  },
};
