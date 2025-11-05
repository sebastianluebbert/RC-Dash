import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
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
  username: string;
  realm: string;
  verify_ssl: boolean;
}

export const ProxmoxSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null);
  const [newNode, setNewNode] = useState({
    name: "",
    host: "",
    port: 8006,
    username: "root@pam",
    password: "",
    realm: "pam",
  });

  const { data: nodes, isLoading } = useQuery({
    queryKey: ['proxmox-nodes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proxmox_nodes')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ProxmoxNode[];
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
          username: newNode.username,
          password: newNode.password,
          realm: newNode.realm,
          verify_ssl: false,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxmox-nodes'] });
      setNewNode({
        name: "",
        host: "",
        port: 8006,
        username: "root@pam",
        password: "",
        realm: "pam",
      });
      toast({
        title: "Erfolg",
        description: "Proxmox-Server wurde erfolgreich hinzugefügt",
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

  const deleteNodeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const { error } = await supabase
        .from('proxmox_nodes')
        .delete()
        .eq('id', nodeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxmox-nodes'] });
      setDeleteNodeId(null);
      toast({
        title: "Erfolg",
        description: "Proxmox-Server wurde gelöscht",
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Neuen Proxmox-Server hinzufügen</CardTitle>
          <CardDescription>
            Verbinden Sie einen Proxmox-Server für VM- und Container-Management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="proxmox-name">Name</Label>
              <Input
                id="proxmox-name"
                placeholder="z.B. Proxmox-Node-1"
                value={newNode.name}
                onChange={(e) => setNewNode({ ...newNode, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="proxmox-host">Host (URL)</Label>
              <Input
                id="proxmox-host"
                placeholder="https://proxmox.example.com"
                value={newNode.host}
                onChange={(e) => setNewNode({ ...newNode, host: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="proxmox-port">Port</Label>
              <Input
                id="proxmox-port"
                type="number"
                placeholder="8006"
                value={newNode.port}
                onChange={(e) => setNewNode({ ...newNode, port: parseInt(e.target.value) || 8006 })}
              />
            </div>
            <div>
              <Label htmlFor="proxmox-username">Benutzername</Label>
              <Input
                id="proxmox-username"
                placeholder="root@pam"
                value={newNode.username}
                onChange={(e) => setNewNode({ ...newNode, username: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="proxmox-password">Passwort</Label>
              <Input
                id="proxmox-password"
                type="password"
                placeholder="Proxmox Passwort"
                value={newNode.password}
                onChange={(e) => setNewNode({ ...newNode, password: e.target.value })}
              />
            </div>
            <Button
              onClick={() => addNodeMutation.mutate()}
              disabled={!newNode.name || !newNode.host || !newNode.username || !newNode.password || addNodeMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Server hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konfigurierte Proxmox-Server</CardTitle>
          <CardDescription>
            Ihre verbundenen Proxmox-Server
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
                    <p className="text-sm text-muted-foreground">{node.host}:{node.port}</p>
                    <p className="text-xs text-muted-foreground">User: {node.username}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => setDeleteNodeId(node.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Keine Proxmox-Server konfiguriert
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
};
