import apiClient from '@/lib/api-client';

export interface DNSZone {
  id: string;
  name: string;
  provider: 'hetzner' | 'autodns';
  record_count?: number;
}

export interface DNSRecord {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl?: number;
}

export const dnsService = {
  // Hetzner DNS
  async getHetznerZones(): Promise<DNSZone[]> {
    const response = await apiClient.get('/dns/hetzner/zones');
    return response.data.zones;
  },

  async getHetznerRecords(zoneId: string): Promise<DNSRecord[]> {
    const response = await apiClient.get(`/dns/hetzner/records/${zoneId}`);
    return response.data.records;
  },

  async manageHetznerRecord(action: 'create' | 'update' | 'delete', zoneId: string, record: any) {
    const response = await apiClient.post('/dns/hetzner/manage', {
      action,
      zoneId,
      record,
    });
    return response.data;
  },

  // AutoDNS
  async getAutoDNSZones(): Promise<DNSZone[]> {
    const response = await apiClient.get('/dns/autodns/zones');
    return response.data.zones;
  },

  async getAutoDNSRecords(zoneName: string): Promise<DNSRecord[]> {
    const response = await apiClient.get(`/dns/autodns/records/${zoneName}`);
    return response.data.records;
  },

  async manageAutoDNSRecord(action: 'create' | 'update' | 'delete', zoneName: string, record: any) {
    const response = await apiClient.post('/dns/autodns/manage', {
      action,
      zoneName,
      record,
    });
    return response.data;
  },

  // Settings
  async saveHetznerApiKey(apiKey: string) {
    const response = await apiClient.post('/settings', {
      key: 'hetzner_api_key',
      value: apiKey,
      description: 'Hetzner DNS API Key',
    });
    return response.data;
  },

  async saveAutoDNSCredentials(username: string, password: string, context: string) {
    const response = await apiClient.post('/settings', {
      key: 'autodns_credentials',
      value: JSON.stringify({ username, password, context }),
      description: 'AutoDNS API Credentials',
    });
    return response.data;
  },
};
