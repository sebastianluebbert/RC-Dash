import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mailService } from "@/services/mail.service";
import { pleskService } from "@/services/plesk.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { DNSProviderSettings } from "@/components/DNSProviderSettings";
import { ProxmoxSettings } from "@/components/ProxmoxSettings";
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
  const [deleteMailServerId, setDeleteMailServerId] = useState<string | null>(null);
  const [deletePleskServerId, setDeletePleskServerId] = useState<string | null>(null);
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
      return await mailService.getServers();
    },
  });

  const { data: pleskServers, isLoading: pleskServersLoading } = useQuery({
    queryKey: ['plesk-servers'],
    queryFn: async () => {
      return await pleskService.getServers();
    },
  });

  const addMailServerMutation = useMutation({
    mutationFn: async () => {
      return await mailService.addServer({
        name: newMailServer.name,
        host: newMailServer.host,
        apiKey: newMailServer.apiKey,
      });
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
      return await mailService.deleteServer(id);
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
      return await pleskService.addServer({
        name: newPleskServer.name,
        host: newPleskServer.host,
        username: newPleskServer.username,
        password: newPleskServer.password,
        port: newPleskServer.port,
      });
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
      return await pleskService.deleteServer(id);
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
          <ProxmoxSettings />
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
