import apiClient from '@/lib/api-client';

export interface UFWRule {
  number?: string;
  action: string;
  from: string;
  to: string;
  port?: string;
  protocol?: string;
}

export interface UFWStatus {
  enabled: boolean;
  rules: UFWRule[];
  defaultIncoming: string;
  defaultOutgoing: string;
}

export const ufwService = {
  async getStatus(serverId: string): Promise<UFWStatus> {
    const response = await apiClient.post('/ufw/manage', {
      serverId,
      action: 'status',
    });
    return response.data;
  },

  async listRules(serverId: string): Promise<UFWRule[]> {
    const response = await apiClient.post('/ufw/manage', {
      serverId,
      action: 'list',
    });
    return response.data.rules || [];
  },

  async enableFirewall(serverId: string): Promise<void> {
    await apiClient.post('/ufw/manage', {
      serverId,
      action: 'enable',
    });
  },

  async disableFirewall(serverId: string): Promise<void> {
    await apiClient.post('/ufw/manage', {
      serverId,
      action: 'disable',
    });
  },

  async addRule(
    serverId: string,
    port: string,
    protocol: 'tcp' | 'udp' | 'any',
    from?: string
  ): Promise<void> {
    await apiClient.post('/ufw/manage', {
      serverId,
      action: 'add',
      port,
      protocol,
      from,
    });
  },

  async deleteRule(serverId: string, ruleNumber: string): Promise<void> {
    await apiClient.post('/ufw/manage', {
      serverId,
      action: 'delete',
      rule: ruleNumber,
    });
  },

  async resetFirewall(serverId: string): Promise<void> {
    await apiClient.post('/ufw/manage', {
      serverId,
      action: 'reset',
    });
  },
};
