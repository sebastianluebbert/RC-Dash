import apiClient from '@/lib/api-client';

export interface VersionInfo {
  version: string;
  packageVersion: string;
  name: string;
  gitTag: string | null;
  commit: {
    hash: string;
    date: string;
  } | null;
}

export interface VersionTag {
  tag: string;
  version: string;
  date: string | null;
  message: string;
  commit: string | null;
}

export interface TagsResponse {
  tags: VersionTag[];
  total: number;
}

export interface UpdateCheck {
  hasUpdate: boolean;
  currentCommit: string;
  latestCommit: string;
  currentVersion: string | null;
  latestVersion: string | null;
  hasVersionUpdate: boolean;
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

export interface ChangelogCommit {
  commit: string;
  short: string;
  author: string;
  date: string;
  message: string;
  body: string;
  category: string;
  type: string;
}

export interface Changelog {
  commits: ChangelogCommit[];
  grouped: Record<string, ChangelogCommit[]>;
  total: number;
}

const getVersion = async (): Promise<VersionInfo> => {
  const response = await apiClient.get('/system/version');
  return response.data;
};

const checkForUpdates = async (): Promise<UpdateCheck> => {
  const response = await apiClient.get('/system/check-update');
  return response.data;
};

const performUpdate = async (): Promise<UpdateResponse> => {
  const response = await apiClient.post('/system/update');
  return response.data;
};

const getChangelog = async (from?: string, to?: string): Promise<Changelog> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  
  const response = await apiClient.get(`/system/changelog?${params.toString()}`);
  return response.data;
};

const getTags = async (): Promise<TagsResponse> => {
  const response = await apiClient.get('/system/tags');
  return response.data;
};

export const systemService = {
  getVersion,
  checkForUpdates,
  performUpdate,
  getChangelog,
  getTags,
};
