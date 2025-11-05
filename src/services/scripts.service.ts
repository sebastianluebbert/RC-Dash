import apiClient from '@/lib/api-client';

export interface HelperScript {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
}

export const scriptsService = {
  async getAvailableScripts(): Promise<HelperScript[]> {
    const response = await apiClient.get('/scripts/available');
    return response.data.scripts;
  },

  async executeScript(
    node: string,
    vmid: number,
    scriptUrl: string,
    scriptName: string
  ) {
    const response = await apiClient.post('/scripts/execute', {
      node,
      vmid,
      scriptUrl,
      scriptName,
    });
    return response.data;
  },
};
