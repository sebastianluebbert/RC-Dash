import { useQuery } from "@tanstack/react-query";
import { Server, Cloud, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ProxmoxServer {
  id: string;
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
}

interface HetznerServer {
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

const Servers = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode("servers-view-mode");

  const { data: proxmoxServers } = useQuery({
    queryKey: ['proxmox-servers'],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxmox-resources`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.servers as ProxmoxServer[];
    },
  });

  const { data: hetznerServers } = useQuery({
    queryKey: ['hetzner-cloud-servers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hetzner-cloud-servers');
      if (error) throw error;
      return data.servers as HetznerServer[];
    },
  });

  // Group Proxmox servers by node
  const nodeStats = proxmoxServers?.reduce((acc, server) => {
    if (!acc[server.node]) {
      acc[server.node] = { total: 0, running: 0, vms: 0, containers: 0 };
    }
    acc[server.node].total++;
    if (server.status.toLowerCase() === 'running') {
      acc[server.node].running++;
    }
    if (server.type === 'qemu') {
      acc[server.node].vms++;
    } else {
      acc[server.node].containers++;
    }
    return acc;
  }, {} as Record<string, { total: number; running: number; vms: number; containers: number }>);

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'running') {
      return <Badge className="bg-success">Läuft</Badge>;
    } else if (statusLower === 'stopped' || statusLower === 'off') {
      return <Badge variant="secondary">Gestoppt</Badge>;
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderProxmoxView = () => {
    if (!nodeStats) return null;

    if (viewMode === "list") {
      return (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node</TableHead>
                <TableHead>Gesamt</TableHead>
                <TableHead>Aktiv</TableHead>
                <TableHead>VMs</TableHead>
                <TableHead>Container</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(nodeStats).map(([node, stats]) => (
                <TableRow key={node} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/server/${node}`)}>
                  <TableCell className="font-semibold">{node}</TableCell>
                  <TableCell>{stats.total}</TableCell>
                  <TableCell className="text-success">{stats.running}</TableCell>
                  <TableCell>{stats.vms}</TableCell>
                  <TableCell>{stats.containers}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/server/${node}`);
                      }}
                    >
                      Verwalten
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      );
    }

    return (
      <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "grid gap-3 md:grid-cols-2 lg:grid-cols-4"}>
        {Object.entries(nodeStats).map(([node, stats]) => (
          <Card 
            key={node} 
            className="cursor-pointer border-border bg-card transition-all hover:shadow-[var(--shadow-glow)]"
            onClick={() => navigate(`/server/${node}`)}
          >
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${viewMode === "compact" ? "pb-2" : "pb-2"}`}>
              <CardTitle className={`font-semibold text-card-foreground ${viewMode === "compact" ? "text-base" : "text-lg"}`}>
                {node}
              </CardTitle>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className={viewMode === "compact" ? "pb-3" : ""}>
              {viewMode === "grid" ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gesamt:</span>
                    <span className="font-medium text-card-foreground">{stats.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Aktiv:</span>
                    <span className="font-medium text-success">{stats.running}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-sm">
                    <span className="text-muted-foreground">VMs:</span>
                    <span className="font-medium text-card-foreground">{stats.vms}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Container:</span>
                    <span className="font-medium text-card-foreground">{stats.containers}</span>
                  </div>
                  <Button 
                    className="mt-3 w-full" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/server/${node}`);
                    }}
                  >
                    Server verwalten
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{stats.total} Server</span>
                  <span className="text-success">{stats.running} aktiv</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderHetznerView = () => {
    if (!hetznerServers || hetznerServers.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Keine Hetzner Cloud Server gefunden
          </CardContent>
        </Card>
      );
    }

    if (viewMode === "list") {
      return (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>IP-Adresse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hetznerServers.map((server) => (
                <TableRow 
                  key={server.id} 
                  className="cursor-pointer hover:bg-muted/50" 
                  onClick={() => navigate(`/hetzner-server/${server.id}`)}
                >
                  <TableCell className="font-semibold">{server.name}</TableCell>
                  <TableCell>{server.server_type.name}</TableCell>
                  <TableCell>{server.datacenter.location.name}</TableCell>
                  <TableCell className="font-mono text-sm">{server.public_net.ipv4?.ip || 'N/A'}</TableCell>
                  <TableCell>{getStatusBadge(server.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/hetzner-server/${server.id}`);
                      }}
                    >
                      Verwalten
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      );
    }

    return (
      <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "grid gap-3 md:grid-cols-2 lg:grid-cols-4"}>
        {hetznerServers.map((server) => (
          <Card 
            key={server.id} 
            className="cursor-pointer border-border bg-card transition-all hover:shadow-[var(--shadow-glow)]"
            onClick={() => navigate(`/hetzner-server/${server.id}`)}
          >
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${viewMode === "compact" ? "pb-2" : "pb-2"}`}>
              <CardTitle className={`font-semibold text-card-foreground ${viewMode === "compact" ? "text-base" : "text-lg"}`}>
                {server.name}
              </CardTitle>
              {getStatusBadge(server.status)}
            </CardHeader>
            <CardContent className={viewMode === "compact" ? "pb-3" : ""}>
              {viewMode === "grid" ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Typ:</span>
                    <span className="font-medium text-card-foreground">{server.server_type.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CPU:</span>
                    <span className="font-medium">{server.server_type.cores} Cores</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">RAM:</span>
                    <span className="font-medium">{server.server_type.memory} GB</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-sm">
                    <span className="text-muted-foreground">Standort:</span>
                    <span className="font-medium text-card-foreground">{server.datacenter.location.name}</span>
                  </div>
                  {server.public_net.ipv4 && (
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {server.public_net.ipv4.ip}
                    </div>
                  )}
                  <Button
                    className="mt-3 w-full" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/hetzner-server/${server.id}`);
                    }}
                  >
                    Server verwalten
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{server.server_type.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">{server.public_net.ipv4?.ip || 'N/A'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alle Server</h1>
          <p className="text-muted-foreground">
            Übersicht über alle Server (Proxmox & Hetzner Cloud)
          </p>
        </div>
        <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      <Tabs defaultValue="proxmox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="proxmox">
            <Server className="mr-2 h-4 w-4" />
            Proxmox
          </TabsTrigger>
          <TabsTrigger value="hetzner">
            <Cloud className="mr-2 h-4 w-4" />
            Hetzner Cloud
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proxmox">
          {renderProxmoxView()}
        </TabsContent>

        <TabsContent value="hetzner">
          {renderHetznerView()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Servers;
