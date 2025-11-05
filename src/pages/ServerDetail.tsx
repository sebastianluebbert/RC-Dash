import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Server as ServerIcon, Play, Square, RotateCw, RefreshCw, Plus, ArrowLeft, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreateVMDialog } from "@/components/CreateVMDialog";
import { CreateLXCDialog } from "@/components/CreateLXCDialog";
import { VNCConsole } from "@/components/VNCConsole";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";

interface Server {
  id: string;
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  memory_total: number | null;
  disk_usage: number | null;
  disk_total: number | null;
  uptime: number | null;
  last_sync: string;
}

const ServerDetail = () => {
  const { node } = useParams<{ node: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isVMDialogOpen, setIsVMDialogOpen] = useState(false);
  const [isLXCDialogOpen, setIsLXCDialogOpen] = useState(false);
  const [vncServer, setVncServer] = useState<Server | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewMode, setViewMode] = useViewMode("server-detail-view-mode");

  const { data: servers, isLoading, refetch } = useQuery({
    queryKey: ['servers', node],
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
        throw new Error('Failed to fetch servers');
      }

      const data = await response.json();
      const allServers = data.servers as Server[];
      return allServers.filter(s => s.node === node);
    },
  });

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetch();
    }, 2000); // 2 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const controlMutation = useMutation({
    mutationFn: async ({ server, action }: { server: Server; action: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxmox-control`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            node: server.node,
            vmid: server.vmid,
            type: server.type,
            action,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to control server');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Aktion erfolgreich",
        description: `${variables.action} wurde auf ${variables.server.name} ausgeführt`,
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['servers', node] });
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'running') {
      return <Badge className="bg-success">Läuft</Badge>;
    } else if (statusLower === 'stopped') {
      return <Badge variant="secondary">Gestoppt</Badge>;
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatUptime = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const handleSync = async () => {
    toast({
      title: "Synchronisierung gestartet",
      description: "Server werden aktualisiert...",
    });
    await refetch();
    toast({
      title: "Synchronisierung abgeschlossen",
      description: "Alle Server wurden aktualisiert",
    });
  };

  const renderServerCard = (server: Server) => (
    <Card key={server.id} className="border-border bg-card">
      <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${viewMode === "compact" ? "pb-2" : "pb-2"}`}>
        <CardTitle className={viewMode === "compact" ? "text-base font-semibold" : "text-lg font-semibold"}>
          <div className="flex items-center gap-2">
            <ServerIcon className={`h-5 w-5 ${server.type === 'qemu' ? 'text-primary' : 'text-accent'}`} />
            <span className="truncate">{server.name}</span>
          </div>
        </CardTitle>
        {getStatusBadge(server.status)}
      </CardHeader>
      <CardContent className={viewMode === "compact" ? "pb-3" : ""}>
        {viewMode === "compact" ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              VMID: {server.vmid}
            </div>
            {server.status.toLowerCase() === 'running' && (
              <div className="text-xs space-y-1">
                <div>CPU: {server.cpu_usage?.toFixed(1)}%</div>
                <div>RAM: {server.memory_usage}MB</div>
              </div>
            )}
            <div className="flex gap-1 pt-2">
              {server.status.toLowerCase() === 'running' ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setVncServer(server)} className="h-7 px-2">
                    <Monitor className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => controlMutation.mutate({ server, action: 'shutdown' })} disabled={controlMutation.isPending} className="h-7 px-2">
                    <Square className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => controlMutation.mutate({ server, action: 'start' })} disabled={controlMutation.isPending} className="h-7 px-2">
                  <Play className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">VMID:</span>
                <span className="ml-2 font-medium">{server.vmid}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Uptime:</span>
                <span className="ml-2 font-medium">{formatUptime(server.uptime)}</span>
              </div>
            </div>

            {server.status.toLowerCase() === 'running' && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CPU:</span>
                  <span className="font-medium">{server.cpu_usage?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">RAM:</span>
                  <span className="font-medium">{server.memory_usage} MB / {server.memory_total} MB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Disk:</span>
                  <span className="font-medium">{server.disk_usage} GB / {server.disk_total} GB</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 border-t border-border pt-3">
              {server.status.toLowerCase() === 'running' ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setVncServer(server)}>
                    <Monitor className="mr-1 h-3 w-3" />
                    Console
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => controlMutation.mutate({ server, action: 'shutdown' })} disabled={controlMutation.isPending}>
                    <Square className="mr-1 h-3 w-3" />
                    Stop
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => controlMutation.mutate({ server, action: 'reboot' })} disabled={controlMutation.isPending}>
                    <RotateCw className="mr-1 h-3 w-3" />
                    Restart
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => controlMutation.mutate({ server, action: 'start' })} disabled={controlMutation.isPending}>
                  <Play className="mr-1 h-3 w-3" />
                  Starten
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const vms = servers?.filter(s => s.type === 'qemu') || [];
  const containers = servers?.filter(s => s.type === 'lxc') || [];

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Server: {node}</h1>
          <p className="text-muted-foreground">
            VMs und Container auf diesem Node
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              Auto-Sync (2s)
            </Label>
          </div>
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <Button onClick={handleSync} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync
          </Button>
          <Button onClick={() => setIsVMDialogOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            VM
          </Button>
          <Button onClick={() => setIsLXCDialogOpen(true)} variant="secondary" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            LXC
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Lade Server...</div>
      ) : (
        <div className="space-y-6">
          {vms.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                Virtuelle Maschinen ({vms.length})
              </h2>
              <div className={viewMode === "list" ? "space-y-4" : viewMode === "compact" ? "grid gap-4 md:grid-cols-3 lg:grid-cols-4" : "grid gap-6 md:grid-cols-2"}>
                {vms.map(renderServerCard)}
              </div>
            </div>
          )}

          {containers.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                LXC Container ({containers.length})
              </h2>
              <div className={viewMode === "list" ? "space-y-4" : viewMode === "compact" ? "grid gap-4 md:grid-cols-3 lg:grid-cols-4" : "grid gap-6 md:grid-cols-2"}>
                {containers.map(renderServerCard)}
              </div>
            </div>
          )}

          {!isLoading && servers?.length === 0 && (
            <div className="text-center text-muted-foreground">
              Keine VMs oder Container auf diesem Server gefunden
            </div>
          )}
        </div>
      )}

      <CreateVMDialog 
        open={isVMDialogOpen} 
        onOpenChange={setIsVMDialogOpen}
        onSuccess={() => {
          setIsVMDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['servers', node] });
        }}
        defaultNode={node}
      />

      <CreateLXCDialog 
        open={isLXCDialogOpen} 
        onOpenChange={setIsLXCDialogOpen}
        onSuccess={() => {
          setIsLXCDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['servers', node] });
        }}
        defaultNode={node}
      />

      {vncServer && (
        <VNCConsole
          open={!!vncServer}
          onOpenChange={(open) => !open && setVncServer(null)}
          node={vncServer.node}
          vmid={vncServer.vmid}
          type={vncServer.type}
          name={vncServer.name}
        />
      )}
    </div>
  );
};

export default ServerDetail;
