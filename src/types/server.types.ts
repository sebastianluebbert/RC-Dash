// Zentrale Server-Type-Definitionen

export interface ProxmoxServer {
  id: string;
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
  cpu_usage?: number;
  memory_usage?: number;
  memory_total?: number;
  disk_usage?: number;
  disk_total?: number;
  uptime?: number;
}

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
    };
  };
  public_net: {
    ipv4: {
      ip: string;
    } | null;
    ipv6?: {
      ip: string;
    } | null;
  };
}

export interface MailServer {
  id: string;
  name: string;
  host: string;
  created_at: string;
}

export interface PleskServer {
  id: string;
  name: string;
  host: string;
  port: number;
  created_at: string;
}
