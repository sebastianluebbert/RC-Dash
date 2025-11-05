import { useQuery } from "@tanstack/react-query";
import { Server, Globe, Activity, AlertTriangle, ChevronRight } from "lucide-react";
import { DashboardCard } from "@/components/DashboardCard";
import { SetupWizard } from "@/components/SetupWizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { proxmoxService } from "@/services/proxmox.service";
import { dnsService } from "@/services/dns.service";
import { useState, useEffect } from "react";

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
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Check if setup was completed
  useEffect(() => {
    const setupCompleted = localStorage.getItem('rexcloud_setup_completed');
    if (!setupCompleted) {
      // Show wizard after a small delay for better UX
      const timer = setTimeout(() => setShowSetupWizard(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      try {
        const data = await proxmoxService.getResources();
        return data.servers as Server[];
      } catch (error) {
        console.error('Failed to fetch servers:', error);
        return [];
      }
    },
  });

  const { data: allZones } = useQuery({
    queryKey: ["all-zones"],
    queryFn: async () => {
      try {
        const [hetznerZones, autodnsZones] = await Promise.all([
          dnsService.getHetznerZones().catch(() => []),
          dnsService.getAutoDNSZones().catch(() => []),
        ]);
        
        return [...hetznerZones, ...autodnsZones];
      } catch (error) {
        console.error('Failed to fetch DNS zones:', error);
        return [];
      }
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
    <>
      <SetupWizard 
        open={showSetupWizard} 
        onClose={() => setShowSetupWizard(false)} 
      />
      
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
      
      {nodeStats && Object.entries(nodeStats).length > 0 && (
        <>
          {viewMode === "list" ? (
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
                    <TableRow 
                      key={node} 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => navigate(`/server/${node}`)}
                    >
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
                  className="cursor-pointer transition-all hover:shadow-[var(--shadow-glow)]"
                  onClick={() => navigate(`/server/${node}`)}
                >
                  <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${viewMode === "compact" ? "pb-2" : "pb-2"}`}>
                    <CardTitle className={`font-semibold ${viewMode === "compact" ? "text-base" : "text-lg"}`}>
                      {node}
                    </CardTitle>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className={viewMode === "compact" ? "pb-3" : ""}>
                    {viewMode === "grid" ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gesamt:</span>
                          <span className="font-medium">{stats.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Aktiv:</span>
                          <span className="font-medium text-success">{stats.running}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2 text-sm">
                          <span className="text-muted-foreground">VMs:</span>
                          <span className="font-medium">{stats.vms}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Container:</span>
                          <span className="font-medium">{stats.containers}</span>
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
          )}
        </>
      )}
      </div>
    </>
  );
};

export default Index;
