import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { scriptsService, HelperScript } from "@/services/scripts.service";
import { proxmoxService } from "@/services/proxmox.service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HelperScripts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedScript, setSelectedScript] = useState<HelperScript | null>(null);
  const [selectedNode, setSelectedNode] = useState<string>("");
  const [selectedVmid, setSelectedVmid] = useState<number>(0);

  const { data: scripts } = useQuery({
    queryKey: ['helper-scripts'],
    queryFn: () => scriptsService.getAvailableScripts(),
  });

  const { data: nodes } = useQuery({
    queryKey: ['proxmox-nodes'],
    queryFn: () => proxmoxService.getNodes(),
  });

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const data = await proxmoxService.getResources();
      return data.servers;
    },
  });

  const categories = Array.from(new Set(scripts?.map(s => s.category) || []));
  
  const filteredScripts = (scripts || []).filter(script => {
    const matchesSearch = script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         script.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || script.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const executeScriptMutation = useMutation({
    mutationFn: ({ node, vmid, scriptUrl, scriptName }: any) =>
      scriptsService.executeScript(node, vmid, scriptUrl, scriptName),
    onSuccess: () => {
      toast({
        title: "Script wird ausgeführt",
        description: "Das Script wurde erfolgreich gestartet",
      });
      setSelectedScript(null);
      setSelectedNode("");
      setSelectedVmid(0);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.response?.data?.error || "Script-Ausführung fehlgeschlagen",
        variant: "destructive",
      });
    },
  });

  const handleInstall = () => {
    if (!selectedScript || !selectedNode || !selectedVmid) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Server aus",
        variant: "destructive",
      });
      return;
    }

    executeScriptMutation.mutate({
      node: selectedNode,
      vmid: selectedVmid,
      scriptUrl: selectedScript.url,
      scriptName: selectedScript.name,
    });
  };

  const nodeServers = servers?.filter(s => s.node === selectedNode) || [];

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Proxmox Helper Scripts</h1>
          <p className="text-muted-foreground">
            Einfache Installation von Anwendungen und Services
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Scripts durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScripts.map((script) => (
          <Card key={script.name} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{script.name}</CardTitle>
                  <CardDescription className="mt-1">{script.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{script.category}</Badge>
                <Button
                  size="sm"
                  onClick={() => setSelectedScript(script)}
                >
                  <Play className="mr-2 h-3 w-3" />
                  Installieren
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedScript} onOpenChange={() => setSelectedScript(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedScript?.name} installieren</DialogTitle>
            <DialogDescription>
              Wählen Sie den Node aus, auf dem das Script ausgeführt werden soll
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Node</label>
              <Select value={selectedNode} onValueChange={(v) => {
                setSelectedNode(v);
                setSelectedVmid(0);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Node auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {nodes?.map((node) => (
                    <SelectItem key={node.id} value={node.name}>
                      {node.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedNode && (
              <div>
                <label className="text-sm font-medium">Server</label>
                <Select value={selectedVmid.toString()} onValueChange={(v) => setSelectedVmid(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Server auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {nodeServers.map((server) => (
                      <SelectItem key={server.id} value={server.vmid.toString()}>
                        {server.name} (VMID: {server.vmid})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                disabled={!selectedNode || !selectedVmid || executeScriptMutation.isPending}
                className="flex-1"
              >
                {executeScriptMutation.isPending ? "Installiert..." : "Installation starten"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedScript(null);
                  setSelectedNode("");
                  setSelectedVmid(0);
                }}
                disabled={executeScriptMutation.isPending}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelperScripts;
