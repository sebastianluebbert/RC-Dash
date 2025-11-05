import apiClient from '@/lib/api-client';

export interface VNCTicket {
  ticket: string;
  port: number;
  upid: string;
  node: string;
  vmid: number;
  vncwebsocket: any;
}

export interface VNCProxy {
  host: string;
  port: number;
  node: string;
  vmid: number;
}

export const vncService = {
  async getVNCTicket(node: string, vmid: number): Promise<VNCTicket> {
    const response = await apiClient.post('/vnc/ticket', {
      node,
      vmid,
    });
    return response.data;
  },

  async getVNCProxy(node: string, vmid: number): Promise<VNCProxy> {
    const response = await apiClient.get(`/vnc/proxy/${node}/${vmid}`);
    return response.data;
  },
};
