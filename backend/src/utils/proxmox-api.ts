import fetch from 'node-fetch';
import { decrypt } from './encryption';

export interface ProxmoxNodeConfig {
  host: string;
  port: number;
  username: string;
  password_encrypted: string;
  realm: string;
}

export interface ProxmoxAuthData {
  ticket: string;
  csrfToken: string;
}

/**
 * Authentifiziert sich bei einem Proxmox-Node
 */
export async function authenticateProxmox(nodeConfig: ProxmoxNodeConfig): Promise<ProxmoxAuthData> {
  const password = decrypt(nodeConfig.password_encrypted);
  
  const authResponse = await fetch(`${nodeConfig.host}/api2/json/access/ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: nodeConfig.username,
      password: password,
      realm: nodeConfig.realm,
    }).toString(),
  });
  
  if (!authResponse.ok) {
    throw new Error('Proxmox authentication failed');
  }
  
  const authData: any = await authResponse.json();
  
  return {
    ticket: authData.data.ticket,
    csrfToken: authData.data.CSRFPreventionToken,
  };
}

/**
 * Führt eine Proxmox API-Anfrage aus
 */
export async function proxmoxRequest(
  nodeConfig: ProxmoxNodeConfig,
  endpoint: string,
  options: {
    method?: string;
    body?: URLSearchParams;
    requireCsrf?: boolean;
  } = {}
): Promise<any> {
  const { ticket, csrfToken } = await authenticateProxmox(nodeConfig);
  
  const headers: any = {
    'Cookie': `PVEAuthCookie=${ticket}`,
  };
  
  if (options.requireCsrf) {
    headers['CSRFPreventionToken'] = csrfToken;
  }
  
  if (options.body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  
  const response = await fetch(`${nodeConfig.host}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body?.toString(),
  });
  
  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    throw new Error(errorData.errors || `Proxmox API error: ${response.statusText}`);
  }
  
  return response.json();
}
