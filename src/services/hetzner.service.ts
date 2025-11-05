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

export interface DNSZone {
  id: string;
  name: string;
  ttl: number;
}

export interface DNSRecord {
  id: string;
  name: string;
  type: string;
  value: string;
  ttl: number;
}

export const hetznerService = {
  // Server Management
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

  // Firewall Management
  async getFirewalls(): Promise<HetznerFirewall[]> {
    const response = await apiClient.get('/hetzner/firewalls');
    return response.data.firewalls;
  },

  async manageFirewall(data: {
    action: 'create' | 'update' | 'delete' | 'attach' | 'detach';
    firewallId?: number;
    serverId?: number;
    [key: string]: any;
  }) {
    const response = await apiClient.post('/hetzner/firewalls/manage', data);
    return response.data;
  },

  // Network Management
  async getNetworks(): Promise<HetznerNetwork[]> {
    const response = await apiClient.get('/hetzner/networks');
    return response.data.networks;
  },

  async manageNetwork(data: {
    action: 'create' | 'update' | 'delete' | 'attach' | 'detach';
    networkId?: number;
    serverId?: number;
    [key: string]: any;
  }) {
    const response = await apiClient.post('/hetzner/networks/manage', data);
    return response.data;
  },

  // DNS Management
  async getDNSZones(): Promise<DNSZone[]> {
    const response = await apiClient.get('/hetzner/dns/zones');
    return response.data.zones || [];
  },

  async getDNSRecords(zoneId: string): Promise<DNSRecord[]> {
    const response = await apiClient.get(`/hetzner/dns/zones/${zoneId}/records`);
    return response.data.records || [];
  },

  async manageDNS(data: {
    action: 'create' | 'update' | 'delete';
    zoneId: string;
    rrsetId?: string;
    record?: {
      name: string;
      type: string;
      ttl?: number;
      value: string;
    };
  }) {
    const response = await apiClient.post('/hetzner/dns/manage', data);
    return response.data;
  },
};
