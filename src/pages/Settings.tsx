import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { DNSProviderSettings } from "@/components/DNSProviderSettings";
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

interface ProxmoxNode {
  id: string;
  name: string;
  host: string;
  port: number;
  realm: string;
  verify_ssl: boolean;
}

interface MailServer {
  id: string;
  name: string;
  host: string;
  created_at: string;
}

interface PleskServer {
  id: string;
  name: string;
  host: string;
  port: number;
  created_at: string;
}

const Settings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null);
  const [deleteMailServerId, setDeleteMailServerId] = useState<string | null>(null);
  const [deletePleskServerId, setDeletePleskServerId] = useState<string | null>(null);
  const [newNode, setNewNode] = useState({
    name: "",
    host: "",
    port: 8006,
    username: "",
    password: "",
    realm: "pam",
  });
  const [newMailServer, setNewMailServer] = useState({
    name: "",
    host: "",
    apiKey: "",
  });
  const [newPleskServer, setNewPleskServer] = useState({
    name: "",
    host: "",
    username: "",
    password: "",
    port: 8443,
  });

  const { data: mailServers, isLoading: mailServersLoading } = useQuery({
    queryKey: ['mailcow-servers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mailcow_servers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as MailServer[];
    },
  });

  const { data: pleskServers, isLoading: pleskServersLoading } = useQuery({
    queryKey: ['plesk-servers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plesk_servers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as PleskServer[];
    },
  });

  const addMailServerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('mailcow-store-credentials', {
        body: {
          name: newMailServer.name,
          host: newMailServer.host,
          apiKey: newMailServer.apiKey,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailcow-servers'] });
      setNewMailServer({ name: "", host: "", apiKey: "" });
      toast({
        title: "Erfolg",
        description: "Mailserver wurde erfolgreich hinzugefügt",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const deleteMailServerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mailcow_servers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailcow-servers'] });
      setDeleteMailServerId(null);
      toast({
        title: "Erfolg",
        description: "Mailserver wurde gelöscht",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const addPleskServerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('plesk-store-credentials', {
        body: {
          name: newPleskServer.name,
          host: newPleskServer.host,
          username: newPleskServer.username,
          password: newPleskServer.password,
          port: newPleskServer.port,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plesk-servers'] });
      setNewPleskServer({ name: "", host: "", username: "", password: "", port: 8443 });
      toast({
        title: "Erfolg",
        description: "Plesk-Server wurde erfolgreich hinzugefügt",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const deletePleskServerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plesk_servers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plesk-servers'] });
      setDeletePleskServerId(null);
      toast({
        title: "Erfolg",
        description: "Plesk-Server wurde gelöscht",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const { data: nodes, isLoading } = useQuery({
    queryKey: ['proxmox-nodes'],
    queryFn: async () => {
      // Get actual servers from the servers table that are synced from Proxmox
      const { data, error } = await supabase
        .from('servers')
        .select('node')
        .order('node');
      
      if (error) throw error;
      
      // Get unique nodes
      const uniqueNodes = Array.from(new Set(data.map(s => s.node)));
      
      // Return node info - in reality these come from PROXMOX_* secrets
      return uniqueNodes.map(node => ({
        id: node,
        name: node,
        host: 'Configured via Secrets',
        port: 8006,
        realm: 'pam',
        verify_ssl: false,
      })) as ProxmoxNode[];
    },
  });

  const addNodeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('proxmox_nodes')
        .insert([{
          name: newNode.name,
          host: newNode.host,
          port: newNode.port,
          realm: newNode.realm,
          verify_ssl: false,
        }])
        .select()
        .single();

      if (error) throw error;

      // Store credentials as secrets
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxmox-store-credentials`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            nodeName: newNode.name,
            username: newNode.username,
            password: newNode.password,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to store credentials');

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Server hinzugefügt",
        description: "Der Proxmox-Server wurde erfolgreich hinzugefügt",
      });
      queryClient.invalidateQueries({ queryKey: ['proxmox-nodes'] });
      setNewNode({
        name: "",
        host: "",
        port: 8006,
        username: "",
        password: "",
        realm: "pam",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const { error } = await supabase
        .from('proxmox_nodes')
        .delete()
        .eq('id', nodeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Server gelöscht",
        description: "Der Proxmox-Server wurde erfolgreich entfernt",
      });
      queryClient.invalidateQueries({ queryKey: ['proxmox-nodes'] });
      setDeleteNodeId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex-1 space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Einstellungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre API-Credentials und Server-Konfiguration
        </p>
      </div>

      <Tabs defaultValue="proxmox" className="space-y-6">
        <TabsList>
          <TabsTrigger value="proxmox">Proxmox Server</TabsTrigger>
          <TabsTrigger value="mail">Mail Server</TabsTrigger>
          <TabsTrigger value="plesk">Plesk Server</TabsTrigger>
          <TabsTrigger value="dns">DNS Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="proxmox" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Proxmox Konfiguration</CardTitle>
              <CardDescription>
                Die Proxmox-Verbindung wird über Lovable Cloud Secrets verwaltet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Konfigurierte Secrets:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>PROXMOX_HOST - Proxmox Server URL</li>
                  <li>PROXMOX_USERNAME - API Benutzername</li>
                  <li>PROXMOX_PASSWORD - API Passwort</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                Diese Konfiguration ermöglicht die Verbindung zu Ihrem Proxmox-Server. 
                Um die Verbindung zu ändern, aktualisieren Sie die entsprechenden Secrets in den Lovable Cloud-Einstellungen.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Konfigurierte Server</CardTitle>
              <CardDescription>
                Server werden über die PROXMOX_HOST, PROXMOX_USERNAME und PROXMOX_PASSWORD Secrets verwaltet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center text-muted-foreground">Lade Server...</div>
              ) : nodes && nodes.length > 0 ? (
                <div className="space-y-4">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <h3 className="font-semibold">{node.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Verbunden über Proxmox API Secrets
                        </p>
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        ✓ Aktiv
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Keine Server gefunden. Stellen Sie sicher, dass PROXMOX_HOST, PROXMOX_USERNAME und PROXMOX_PASSWORD als Secrets konfiguriert sind.
                </div>
              )}
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Hinweis:</strong> Die Proxmox-Verbindung wird über Secrets verwaltet. 
                  Um einen neuen Server hinzuzufügen oder die Konfiguration zu ändern, aktualisieren Sie die 
                  PROXMOX_HOST, PROXMOX_USERNAME und PROXMOX_PASSWORD Secrets in den Lovable Cloud-Einstellungen.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mail" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mailcow Server hinzufügen</CardTitle>
              <CardDescription>
                Verbinden Sie Ihre Mailcow Server mit der API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mail-name">Name</Label>
                  <Input
                    id="mail-name"
                    placeholder="z.B. Mail-Server 1"
                    value={newMailServer.name}
                    onChange={(e) => setNewMailServer({ ...newMailServer, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="mail-host">Host (URL)</Label>
                  <Input
                    id="mail-host"
                    placeholder="https://mail.example.com"
                    value={newMailServer.host}
                    onChange={(e) => setNewMailServer({ ...newMailServer, host: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="mail-apikey">API Key</Label>
                  <Input
                    id="mail-apikey"
                    type="password"
                    placeholder="Mailcow API Key"
                    value={newMailServer.apiKey}
                    onChange={(e) => setNewMailServer({ ...newMailServer, apiKey: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() => addMailServerMutation.mutate()}
                  disabled={!newMailServer.name || !newMailServer.host || !newMailServer.apiKey || addMailServerMutation.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Server hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Konfigurierte Mailserver</CardTitle>
              <CardDescription>
                Ihre verbundenen Mailcow Server
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mailServersLoading ? (
                <div className="text-center text-muted-foreground">Lade Mailserver...</div>
              ) : mailServers && mailServers.length > 0 ? (
                <div className="space-y-4">
                  {mailServers.map((server) => (
                    <div
                      key={server.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <h3 className="font-semibold">{server.name}</h3>
                        <p className="text-sm text-muted-foreground">{server.host}</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setDeleteMailServerId(server.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Keine Mailserver konfiguriert
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plesk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Neuen Plesk-Server hinzufügen</CardTitle>
              <CardDescription>
                Verbinden Sie einen Plesk-Server mit Benutzername und Passwort
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="plesk-name">Server-Name</Label>
                  <Input
                    id="plesk-name"
                    placeholder="z.B. Webhosting Server 1"
                    value={newPleskServer.name}
                    onChange={(e) => setNewPleskServer({ ...newPleskServer, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="plesk-host">Host (URL)</Label>
                  <Input
                    id="plesk-host"
                    placeholder="https://plesk.example.com"
                    value={newPleskServer.host}
                    onChange={(e) => setNewPleskServer({ ...newPleskServer, host: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="plesk-username">Benutzername</Label>
                  <Input
                    id="plesk-username"
                    placeholder="admin"
                    value={newPleskServer.username}
                    onChange={(e) => setNewPleskServer({ ...newPleskServer, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="plesk-password">Passwort</Label>
                  <Input
                    id="plesk-password"
                    type="password"
                    placeholder="Plesk Passwort"
                    value={newPleskServer.password}
                    onChange={(e) => setNewPleskServer({ ...newPleskServer, password: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="plesk-port">Port</Label>
                  <Input
                    id="plesk-port"
                    type="number"
                    placeholder="8443"
                    value={newPleskServer.port}
                    onChange={(e) => setNewPleskServer({ ...newPleskServer, port: parseInt(e.target.value) || 8443 })}
                  />
                </div>
                <Button
                  onClick={() => addPleskServerMutation.mutate()}
                  disabled={!newPleskServer.name || !newPleskServer.host || !newPleskServer.username || !newPleskServer.password || addPleskServerMutation.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Server hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Konfigurierte Plesk-Server</CardTitle>
              <CardDescription>
                Ihre verbundenen Plesk-Server
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pleskServersLoading ? (
                <div className="text-center text-muted-foreground">Lade Plesk-Server...</div>
              ) : pleskServers && pleskServers.length > 0 ? (
                <div className="space-y-4">
                  {pleskServers.map((server) => (
                    <div
                      key={server.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <h3 className="font-semibold">{server.name}</h3>
                        <p className="text-sm text-muted-foreground">{server.host}</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setDeletePleskServerId(server.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  Keine Plesk-Server konfiguriert
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dns" className="space-y-6">
          <DNSProviderSettings />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteNodeId} onOpenChange={() => setDeleteNodeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Server löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diesen Server entfernen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNodeId && deleteNodeMutation.mutate(deleteNodeId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteMailServerId} onOpenChange={() => setDeleteMailServerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mailserver löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diesen Mailserver entfernen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMailServerId && deleteMailServerMutation.mutate(deleteMailServerId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePleskServerId} onOpenChange={() => setDeletePleskServerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plesk-Server löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie diesen Plesk-Server entfernen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePleskServerId && deletePleskServerMutation.mutate(deletePleskServerId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
