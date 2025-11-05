import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Cloud, Play, Square, RotateCw, RefreshCw, ArrowLeft, Trash2, Shield, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
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
      city: string;
    };
  };
  public_net: {
    ipv4: {
      ip: string;
      blocked: boolean;
    } | null;
    ipv6: {
      ip: string;
      blocked: boolean;
    } | null;
    firewalls: Array<{
      id: number;
      name: string;
      status: string;
    }>;
  };
  private_net: Array<{
    network: number;
    ip: string;
  }>;
}

interface Firewall {
  id: number;
  name: string;
  rules: Array<{
    direction: string;
    source_ips: string[];
    destination_ips: string[];
    protocol: string;
    port: string;
    description: string;
  }>;
  applied_to: Array<{
    type: string;
    server: {
      id: number;
      name: string;
    };
  }>;
}

interface NetworkInterface {
  id: number;
  name: string;
  ip_range: string;
  subnets: Array<{
    ip_range: string;
    network_zone: string;
    gateway: string;
  }>;
  servers: number[];
}

const HetznerServerDetail = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: servers, isLoading: serversLoading, refetch: refetchServers } = useQuery({
    queryKey: ['hetzner-cloud-servers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hetzner-cloud-servers');
      if (error) throw error;
      return data.servers as HetznerServer[];
    },
  });

  const { data: firewalls, isLoading: firewallsLoading, refetch: refetchFirewalls } = useQuery({
    queryKey: ['hetzner-cloud-firewalls'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hetzner-cloud-firewalls');
      if (error) throw error;
      return data.firewalls as Firewall[];
    },
  });

  const { data: networks, isLoading: networksLoading, refetch: refetchNetworks } = useQuery({
    queryKey: ['hetzner-cloud-networks'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('hetzner-cloud-networks');
      if (error) throw error;
      return data.networks as NetworkInterface[];
    },
  });

  const server = servers?.find(s => s.id === parseInt(serverId || '0'));

  const controlMutation = useMutation({
    mutationFn: async (action: string) => {
      const { data, error } = await supabase.functions.invoke('hetzner-cloud-server-actions', {
        body: { serverId: parseInt(serverId || '0'), action },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, action) => {
      toast({
        title: "Aktion erfolgreich",
        description: `${action} wurde ausgeführt`,
      });
      setTimeout(() => {
        refetchServers();
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

  const firewallMutation = useMutation({
    mutationFn: async ({ action, firewallId }: { action: string; firewallId: number }) => {
      const { data, error } = await supabase.functions.invoke('hetzner-cloud-firewalls', {
        body: { action, firewallId, serverId: parseInt(serverId || '0') },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Erfolg", description: "Firewall-Aktion wurde ausgeführt" });
      refetchFirewalls();
      refetchServers();
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const networkMutation = useMutation({
    mutationFn: async ({ action, networkId }: { action: string; networkId: number }) => {
      const { data, error } = await supabase.functions.invoke('hetzner-cloud-networks', {
        body: { action, networkId, serverId: parseInt(serverId || '0') },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Erfolg", description: "Netzwerk-Aktion wurde ausgeführt" });
      refetchNetworks();
      refetchServers();
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

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

  const handleDelete = async () => {
    try {
      await controlMutation.mutateAsync('delete');
      toast({ title: "Server gelöscht", description: "Der Server wurde erfolgreich gelöscht" });
      navigate('/servers');
    } catch (error) {
      // Error already handled by mutation
    }
  };

  if (serversLoading) {
    return <div className="flex-1 p-8 text-center text-muted-foreground">Lade Server...</div>;
  }

  if (!server) {
    return <div className="flex-1 p-8 text-center text-muted-foreground">Server nicht gefunden</div>;
  }

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/servers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Cloud className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">{server.name}</h1>
              <p className="text-muted-foreground">{server.server_type.name} • {server.datacenter.location.city}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(server.status)}
          <Button onClick={() => refetchServers()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">CPU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{server.server_type.cores} Cores</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">RAM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{server.server_type.memory} GB</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Disk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{server.server_type.disk} GB</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Netzwerk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {server.public_net.ipv4 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IPv4:</span>
              <span className="font-mono font-medium">{server.public_net.ipv4.ip}</span>
            </div>
          )}
          {server.public_net.ipv6 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IPv6:</span>
              <span className="font-mono font-medium">{server.public_net.ipv6.ip}</span>
            </div>
          )}
          {!server.public_net.ipv4 && !server.public_net.ipv6 && (
            <p className="text-sm text-muted-foreground">Keine öffentlichen IPs zugewiesen</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Server-Aktionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {server.status.toLowerCase() === 'running' ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => controlMutation.mutate('shutdown')} 
                  disabled={controlMutation.isPending}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Herunterfahren
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => controlMutation.mutate('reboot')} 
                  disabled={controlMutation.isPending}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  Neu starten
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => controlMutation.mutate('start')} 
                disabled={controlMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                Starten
              </Button>
            )}
            <Button 
              variant="destructive" 
              onClick={() => setDeleteDialogOpen(true)}
              className="ml-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Server löschen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="firewalls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="firewalls">
            <Shield className="mr-2 h-4 w-4" />
            Firewalls
          </TabsTrigger>
          <TabsTrigger value="networks">
            <Network className="mr-2 h-4 w-4" />
            Netzwerke
          </TabsTrigger>
        </TabsList>

        <TabsContent value="firewalls">
          <Card>
            <CardHeader>
              <CardTitle>Firewall-Verwaltung</CardTitle>
              <CardDescription>
                Verwalte Firewalls für diesen Server
              </CardDescription>
            </CardHeader>
            <CardContent>
              {firewallsLoading ? (
                <div className="text-center text-muted-foreground">Lade Firewalls...</div>
              ) : firewalls && firewalls.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Regeln</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firewalls.map((firewall) => {
                      const isAttached = server.public_net.firewalls.some(f => f.id === firewall.id);
                      return (
                        <TableRow key={firewall.id}>
                          <TableCell className="font-medium">{firewall.name}</TableCell>
                          <TableCell>{firewall.rules.length} Regeln</TableCell>
                          <TableCell>
                            {isAttached ? (
                              <Badge className="bg-success">Aktiv</Badge>
                            ) : (
                              <Badge variant="secondary">Nicht verbunden</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAttached ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => firewallMutation.mutate({ action: 'detach', firewallId: firewall.id })}
                                disabled={firewallMutation.isPending}
                              >
                                Entfernen
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => firewallMutation.mutate({ action: 'attach', firewallId: firewall.id })}
                                disabled={firewallMutation.isPending}
                              >
                                Verbinden
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Keine Firewalls gefunden
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="networks">
          <Card>
            <CardHeader>
              <CardTitle>Netzwerk-Verwaltung</CardTitle>
              <CardDescription>
                Verwalte private Netzwerke für diesen Server
              </CardDescription>
            </CardHeader>
            <CardContent>
              {networksLoading ? (
                <div className="text-center text-muted-foreground">Lade Netzwerke...</div>
              ) : networks && networks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>IP-Bereich</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networks.map((network) => {
                      const isAttached = server.private_net.some(pn => pn.network === network.id);
                      const serverIp = server.private_net.find(pn => pn.network === network.id)?.ip;
                      return (
                        <TableRow key={network.id}>
                          <TableCell className="font-medium">{network.name}</TableCell>
                          <TableCell className="font-mono text-sm">{network.ip_range}</TableCell>
                          <TableCell>
                            {isAttached ? (
                              <div>
                                <Badge className="bg-success">Verbunden</Badge>
                                {serverIp && <div className="text-xs text-muted-foreground mt-1 font-mono">{serverIp}</div>}
                              </div>
                            ) : (
                              <Badge variant="secondary">Nicht verbunden</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAttached ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => networkMutation.mutate({ action: 'detach', networkId: network.id })}
                                disabled={networkMutation.isPending}
                              >
                                Trennen
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => networkMutation.mutate({ action: 'attach', networkId: network.id })}
                                disabled={networkMutation.isPending}
                              >
                                Verbinden
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Keine Netzwerke gefunden
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Server wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Der Server "{server.name}" wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HetznerServerDetail;
