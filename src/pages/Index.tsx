import { useQuery } from "@tanstack/react-query";
import { Server, Globe, Activity, AlertTriangle, ChevronRight } from "lucide-react";
import { DashboardCard } from "@/components/DashboardCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface Server {
  id: string;
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode("servers-view-mode");

  const { data: servers } = useQuery({
    queryKey: ['servers'],
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
      return data.servers as Server[];
    },
  });

  const { data: allZones } = useQuery({
    queryKey: ["all-zones"],
    queryFn: async () => {
      const [hetznerResponse, autodnsResponse] = await Promise.all([
        supabase.functions.invoke("hetzner-zones"),
        supabase.functions.invoke("autodns-zones"),
      ]);

      const hetznerZones = hetznerResponse.data?.zones || [];
      const autodnsZones = autodnsResponse.data?.zones || [];
      
      return [...hetznerZones, ...autodnsZones];
    },
  });

  // Group servers by node
  const nodeStats = servers?.reduce((acc, server) => {
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

  const totalServers = servers?.length || 0;
  const runningServers = servers?.filter(s => s.status.toLowerCase() === 'running').length || 0;

  // Calculate domains count from DNS providers
  const domainsCount = allZones?.length || 0;

  // Calculate uptime percentage based on running vs total servers
  const uptimePercentage = totalServers > 0 ? ((runningServers / totalServers) * 100).toFixed(1) : '0.0';

  // Count active issues (stopped servers)
  const activeIssues = servers?.filter(s => s.status.toLowerCase() === 'stopped').length || 0;

  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Übersicht über Ihre Hosting-Infrastruktur
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="cursor-pointer" onClick={() => navigate('/servers')}>
          <DashboardCard
            title="VMs & Container"
            value={totalServers}
            description={`${runningServers} aktiv`}
            icon={Server}
            status="success"
          />
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/domains')}>
          <DashboardCard
            title="Domains"
            value={domainsCount}
            description="Registrierte Domains"
            icon={Globe}
            status="normal"
          />
        </div>
        <DashboardCard
          title="Uptime"
          value={`${uptimePercentage}%`}
          description="Server-Verfügbarkeit"
          icon={Activity}
          status="success"
        />
        <DashboardCard
          title="Probleme"
          value={activeIssues}
          description="Gestoppte Server"
          icon={AlertTriangle}
          status={activeIssues > 0 ? "warning" : "success"}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-foreground">Proxmox Server</h2>
        <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>
      
      {nodeStats && (
        viewMode === "list" ? (
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
        ) : (
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
        )
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-card-foreground">
            Letzte Aktivitäten
          </h3>
          <div className="space-y-4">
            {[
              {
                action: "Server neu gestartet",
                server: "web-prod-01",
                time: "vor 2 Stunden",
              },
              {
                action: "Domain erneuert",
                server: "beispiel-domain.de",
                time: "vor 5 Stunden",
              },
              {
                action: "Backup erstellt",
                server: "db-main-01",
                time: "vor 8 Stunden",
              },
            ].map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium text-card-foreground">
                    {activity.action}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activity.server}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-card-foreground">
            System Status
          </h3>
          <div className="space-y-4">
            {[
              { name: "API Server", status: "Operational", uptime: "100%" },
              { name: "Database", status: "Operational", uptime: "99.9%" },
              { name: "DNS Service", status: "Operational", uptime: "100%" },
              { name: "Mail Server", status: "Degraded", uptime: "95.2%" },
            ].map((system, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      system.status === "Operational"
                        ? "bg-success"
                        : "bg-warning"
                    }`}
                  />
                  <span className="font-medium text-card-foreground">
                    {system.name}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {system.uptime}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      system.status === "Operational"
                        ? "text-success"
                        : "text-warning"
                    }`}
                  >
                    {system.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
