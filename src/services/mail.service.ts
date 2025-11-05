import apiClient from '@/lib/api-client';

export interface MailServer {
  id: string;
  name: string;
  host: string;
  created_at: string;
}

export interface Mailbox {
  username: string;
  domain: string;
  name: string;
  quota: number;
  active: boolean;
}

export interface Domain {
  domain_name: string;
  description: string;
  aliases: number;
  mailboxes: number;
  active: boolean;
}

export const mailService = {
  async getServers(): Promise<MailServer[]> {
    const response = await apiClient.get('/mail/servers');
    return response.data.servers;
  },

  async addServer(data: { name: string; host: string; apiKey: string }) {
    const response = await apiClient.post('/mail/servers', data);
    return response.data;
  },

  async deleteServer(id: string) {
    const response = await apiClient.delete(`/mail/servers/${id}`);
    return response.data;
  },

  async getMailboxes(serverId: string): Promise<Mailbox[]> {
    const response = await apiClient.get(`/mail/servers/${serverId}/mailboxes`);
    return response.data.mailboxes;
  },

  async getDomains(serverId: string): Promise<Domain[]> {
    const response = await apiClient.get(`/mail/servers/${serverId}/domains`);
    return response.data.domains;
  },

  async manageMailbox(serverId: string, action: 'create' | 'update' | 'delete', mailbox: any) {
    const response = await apiClient.post(`/mail/servers/${serverId}/mailboxes/manage`, {
      action,
      mailbox,
    });
    return response.data;
  },

  async manageDomain(serverId: string, action: 'create' | 'update' | 'delete', domain: any) {
    const response = await apiClient.post(`/mail/servers/${serverId}/domains/manage`, {
      action,
      domain,
    });
    return response.data;
  },

  async testConnection(host: string, apiKey: string) {
    const response = await apiClient.post('/mail/test-connection', { host, apiKey });
    return response.data;
  },
};
