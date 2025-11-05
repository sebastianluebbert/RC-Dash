import apiClient from '@/lib/api-client';

export interface CertificateInfo {
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  autoRenewalEnabled: boolean;
  lastRenewal: string | null;
}

export interface SSLStatus {
  enabled: boolean;
  certificate?: CertificateInfo;
  needsRenewal?: boolean;
  message?: string;
  domain?: string;
}

export interface RenewalHistoryEntry {
  timestamp: string;
  message: string;
}

export interface RenewalHistory {
  entries: RenewalHistoryEntry[];
  total: number;
}

export const sslService = {
  async getStatus(): Promise<SSLStatus> {
    const response = await apiClient.get('/ssl/status');
    return response.data;
  },

  async renewCertificate() {
    const response = await apiClient.post('/ssl/renew');
    return response.data;
  },

  async testConfiguration() {
    const response = await apiClient.post('/ssl/test');
    return response.data;
  },

  async getRenewalHistory(): Promise<RenewalHistory> {
    const response = await apiClient.get('/ssl/history');
    return response.data;
  },
};
