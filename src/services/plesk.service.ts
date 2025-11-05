import apiClient from '@/lib/api-client';

export interface PleskServer {
  id: string;
  name: string;
  host: string;
  port: number;
  created_at: string;
}

export interface Website {
  id: string;
  name: string;
  status: string;
  type: string;
}

export const pleskService = {
  async getServers(): Promise<PleskServer[]> {
    const response = await apiClient.get('/plesk/servers');
    return response.data.servers;
  },

  async addServer(data: {
    name: string;
    host: string;
    username: string;
    password: string;
    port: number;
  }) {
    const response = await apiClient.post('/plesk/servers', data);
    return response.data;
  },

  async deleteServer(id: string) {
    const response = await apiClient.delete(`/plesk/servers/${id}`);
    return response.data;
  },

  async getWebsites(serverId: string): Promise<Website[]> {
    const response = await apiClient.get(`/plesk/servers/${serverId}/websites`);
    return response.data.websites;
  },

  async testConnection(host: string, username: string, password: string, port: number) {
    const response = await apiClient.post('/plesk/test-connection', {
      host,
      username,
      password,
      port,
    });
    return response.data;
  },
};
