import { supabase } from '@/integrations/supabase/client';

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
    const { data, error } = await supabase.functions.invoke('ufw-manage', {
      body: {
        serverId,
        action: 'status',
      },
    });

    if (error) throw error;
    return data;
  },

  async listRules(serverId: string): Promise<UFWRule[]> {
    const { data, error } = await supabase.functions.invoke('ufw-manage', {
      body: {
        serverId,
        action: 'list',
      },
    });

    if (error) throw error;
    return data.rules || [];
  },

  async enableFirewall(serverId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('ufw-manage', {
      body: {
        serverId,
        action: 'enable',
      },
    });

    if (error) throw error;
  },

  async disableFirewall(serverId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('ufw-manage', {
      body: {
        serverId,
        action: 'disable',
      },
    });

    if (error) throw error;
  },

  async addRule(
    serverId: string,
    port: string,
    protocol: 'tcp' | 'udp' | 'any',
    from?: string
  ): Promise<void> {
    const { error } = await supabase.functions.invoke('ufw-manage', {
      body: {
        serverId,
        action: 'add',
        port,
        protocol,
        from,
      },
    });

    if (error) throw error;
  },

  async deleteRule(serverId: string, ruleNumber: string): Promise<void> {
    const { error } = await supabase.functions.invoke('ufw-manage', {
      body: {
        serverId,
        action: 'delete',
        rule: ruleNumber,
      },
    });

    if (error) throw error;
  },

  async resetFirewall(serverId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('ufw-manage', {
      body: {
        serverId,
        action: 'reset',
      },
    });

    if (error) throw error;
  },
};
