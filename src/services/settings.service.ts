import apiClient from '@/lib/api-client';

export interface Setting {
  id: string;
  key: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const settingsService = {
  async getAllSettings(): Promise<Setting[]> {
    const response = await apiClient.get('/settings');
    return response.data.settings;
  },

  async getSetting(key: string): Promise<{ value: any }> {
    const response = await apiClient.get(`/settings/${key}`);
    return response.data;
  },

  async updateSetting(key: string, value: string, description?: string) {
    const response = await apiClient.post('/settings', {
      key,
      value,
      description,
    });
    return response.data;
  },

  async deleteSetting(key: string) {
    const response = await apiClient.delete(`/settings/${key}`);
    return response.data;
  },
};
