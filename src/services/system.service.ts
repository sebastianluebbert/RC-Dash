import apiClient from '@/lib/api-client';

export interface VersionInfo {
  version: string;
  name: string;
}

export interface UpdateCheck {
  hasUpdate: boolean;
  currentCommit: string;
  latestCommit: string;
  updateInfo?: {
    available: boolean;
    commits: number;
    changes: string[];
  };
}

export interface UpdateResponse {
  message: string;
  status: string;
}

const getVersion = async (): Promise<VersionInfo> => {
  const response = await apiClient.get('/api/system/version');
  return response.data;
};

const checkForUpdates = async (): Promise<UpdateCheck> => {
  const response = await apiClient.get('/api/system/check-update');
  return response.data;
};

const performUpdate = async (): Promise<UpdateResponse> => {
  const response = await apiClient.post('/api/system/update');
  return response.data;
};

export const systemService = {
  getVersion,
  checkForUpdates,
  performUpdate,
};
