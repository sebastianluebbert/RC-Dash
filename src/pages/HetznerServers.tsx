import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { hetznerService, HetznerServer } from "@/services/hetzner.service";
import { Server, Power, PowerOff, RotateCw, Zap, MapPin, HardDrive, Cpu, MemoryStick } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HetznerServers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actionServer, setActionServer] = useState<{ id: string; action: string; name: string } | null>(null);

  const { data: servers, isLoading } = useQuery({
    queryKey: ['hetzner-servers'],
    queryFn: async () => {
      try {
        return await hetznerService.getServers();
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Hetzner API Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.",
          variant: "destructive",
        });
        return [];
      }
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ serverId, action }: { serverId: string; action: any }) => {
      return await hetznerService.serverAction(serverId, action);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hetzner-servers'] });
      setActionServer(null);
      toast({
        title: "Erfolg",
        description: `Server-Aktion "${variables.action}" wurde ausgeführt`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.response?.data?.error || "Aktion fehlgeschlagen",
        variant: "destructive",
      });
    },
  });

  const handleAction = (server: HetznerServer, action: 'poweron' | 'poweroff' | 'reboot') => {
    setActionServer({
      id: server.id.toString(),
      action,
      name: server.name,
    });
  };

  const confirmAction = () => {
    if (actionServer) {
      actionMutation.mutate({
        serverId: actionServer.id,
        action: actionServer.action as any,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return <Badge className="bg-green-500">Running</Badge>;
      case 'off':
        return <Badge variant="secondary">Off</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'poweron': return 'Starten';
      case 'poweroff': return 'Ausschalten';
      case 'reboot': return 'Neustarten';
      default: return action;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Hetzner Cloud</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre Hetzner Cloud Server
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted" />
              <CardContent className="h-32 bg-muted/50" />
            </Card>
          ))}
        </div>
      ) : servers && servers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Card key={server.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {server.name}
                  </CardTitle>
                  {getStatusBadge(server.status)}
                </div>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {server.datacenter.location.city}, {server.datacenter.location.country}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Cpu className="h-4 w-4" />
                      CPU
                    </span>
                    <span className="font-medium">{server.server_type.cores} Cores</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MemoryStick className="h-4 w-4" />
                      RAM
                    </span>
                    <span className="font-medium">{server.server_type.memory} GB</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <HardDrive className="h-4 w-4" />
                      Disk
                    </span>
                    <span className="font-medium">{server.server_type.disk} GB</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">IPv4</span>
                    <span className="font-mono text-xs">{server.public_net.ipv4.ip}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {server.status === 'off' ? (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAction(server, 'poweron')}
                    >
                      <Power className="mr-2 h-4 w-4" />
                      Starten
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleAction(server, 'reboot')}
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        Reboot
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleAction(server, 'poweroff')}
                      >
                        <PowerOff className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Zap className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Keine Hetzner Cloud Server gefunden</p>
              <p className="text-sm mt-2">
                Bitte konfigurieren Sie Ihren Hetzner API Key in den Einstellungen
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!actionServer} onOpenChange={() => setActionServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Server-Aktion bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{actionServer?.name}" wirklich {getActionLabel(actionServer?.action || '')}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              Bestätigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HetznerServers;
