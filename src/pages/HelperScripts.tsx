import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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

interface HelperScript {
  name: string;
  category: string;
  description: string;
  scriptUrl: string;
  type: 'ct' | 'vm' | 'install' | 'misc';
}

const HELPER_SCRIPTS: HelperScript[] = [
  {
    name: "Home Assistant",
    category: "Home Automation",
    description: "Home Assistant Core installation",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/homeassistant-core.sh",
    type: "ct"
  },
  {
    name: "Docker",
    category: "Container",
    description: "Docker LXC container",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/docker.sh",
    type: "ct"
  },
  {
    name: "Portainer",
    category: "Container Management",
    description: "Portainer Docker UI",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/portainer.sh",
    type: "ct"
  },
  {
    name: "Nginx Proxy Manager",
    category: "Reverse Proxy",
    description: "Nginx Proxy Manager",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/nginxproxymanager.sh",
    type: "ct"
  },
  {
    name: "AdGuard Home",
    category: "DNS",
    description: "AdGuard Home DNS blocker",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/adguard.sh",
    type: "ct"
  },
  {
    name: "Pi-hole",
    category: "DNS",
    description: "Pi-hole DNS blocker",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/pihole.sh",
    type: "ct"
  },
  {
    name: "Plex",
    category: "Media Server",
    description: "Plex Media Server",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/plex.sh",
    type: "ct"
  },
  {
    name: "Jellyfin",
    category: "Media Server",
    description: "Jellyfin Media Server",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/jellyfin.sh",
    type: "ct"
  },
  {
    name: "Nextcloud",
    category: "Cloud Storage",
    description: "Nextcloud file sync and share",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/nextcloud.sh",
    type: "ct"
  },
  {
    name: "Vaultwarden",
    category: "Password Manager",
    description: "Vaultwarden (Bitwarden) password manager",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/vaultwarden.sh",
    type: "ct"
  },
  {
    name: "Uptime Kuma",
    category: "Monitoring",
    description: "Uptime monitoring tool",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/uptimekuma.sh",
    type: "ct"
  },
  {
    name: "Grafana",
    category: "Monitoring",
    description: "Grafana analytics platform",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/grafana.sh",
    type: "ct"
  },
  {
    name: "Post PVE Install",
    category: "System",
    description: "Post-installation setup for Proxmox VE",
    scriptUrl: "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/post-pve-install.sh",
    type: "misc"
  }
];

const HelperScripts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedScript, setSelectedScript] = useState<HelperScript | null>(null);
  const [selectedNode, setSelectedNode] = useState<string>("");
  const [isInstalling, setIsInstalling] = useState(false);

  const categories = Array.from(new Set(HELPER_SCRIPTS.map(s => s.category)));
  
  const filteredScripts = HELPER_SCRIPTS.filter(script => {
    const matchesSearch = script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         script.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || script.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = async () => {
    if (!selectedScript || !selectedNode) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Node aus",
        variant: "destructive",
      });
      return;
    }

    setIsInstalling(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxmox-execute-script`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            node: selectedNode,
            scriptUrl: selectedScript.scriptUrl,
            scriptName: selectedScript.name,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Installation fehlgeschlagen');
      }

      toast({
        title: "Installation gestartet",
        description: `${selectedScript.name} wird auf ${selectedNode} installiert`,
      });

      setSelectedScript(null);
      setSelectedNode("");
    } catch (error) {
      console.error('Installation error:', error);
      toast({
        title: "Installation fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };

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
              <Select value={selectedNode} onValueChange={setSelectedNode}>
                <SelectTrigger>
                  <SelectValue placeholder="Node auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pve1">pve1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                disabled={!selectedNode || isInstalling}
                className="flex-1"
              >
                {isInstalling ? "Installiert..." : "Installation starten"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedScript(null)}
                disabled={isInstalling}
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
