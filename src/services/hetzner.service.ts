import apiClient from '@/lib/api-client';

export interface HetznerServer {
  id: number;
  name: string;
  status: string;
  server_type: {
    name: string;
    cores: number;
    memory: number;
    disk: number;
  };
  datacenter: {
    name: string;
    location: {
      name: string;
      city: string;
      country: string;
    };
  };
  public_net: {
    ipv4: {
      ip: string;
    };
    ipv6?: {
      ip: string;
    };
  };
  created: string;
}

export interface HetznerFirewall {
  id: number;
  name: string;
  rules: any[];
  applied_to: any[];
}

export interface HetznerNetwork {
  id: number;
  name: string;
  ip_range: string;
  subnets: any[];
}

export const hetznerService = {
  async getServers(): Promise<HetznerServer[]> {
    const response = await apiClient.get('/hetzner/servers');
    return response.data.servers;
  },

  async getServerDetails(id: number): Promise<HetznerServer> {
    const response = await apiClient.get(`/hetzner/servers/${id}`);
    return response.data.server;
  },

  async serverAction(serverId: string, action: 'poweron' | 'poweroff' | 'reboot' | 'reset' | 'shutdown') {
    const response = await apiClient.post('/hetzner/servers/action', {
      serverId,
      action,
    });
    return response.data;
  },

  async getServerMetrics(id: number, type: string, start: string, end: string) {
    const response = await apiClient.get(`/hetzner/servers/${id}/metrics`, {
      params: { type, start, end },
    });
    return response.data.metrics;
  },

  async getFirewalls(): Promise<HetznerFirewall[]> {
    const response = await apiClient.get('/hetzner/firewalls');
    return response.data.firewalls;
  },

  async getNetworks(): Promise<HetznerNetwork[]> {
    const response = await apiClient.get('/hetzner/networks');
    return response.data.networks;
  },
};
