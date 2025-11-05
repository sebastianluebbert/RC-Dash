import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface CreateLXCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultNode?: string;
}

export function CreateLXCDialog({ open, onOpenChange, onSuccess, defaultNode }: CreateLXCDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    node: defaultNode || 'pve',
    vmid: '',
    hostname: '',
    ostemplate: 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
    cores: '1',
    memory: '512',
    disk: '8',
    password: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxmox-create-lxc`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            node: data.node,
            vmid: parseInt(data.vmid),
            hostname: data.hostname,
            ostemplate: data.ostemplate,
            cores: parseInt(data.cores),
            memory: parseInt(data.memory),
            disk: parseInt(data.disk),
            password: data.password || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create container');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Container wird erstellt",
        description: "Der Container wird auf Ihrem Proxmox-Server erstellt",
      });
      onSuccess();
      setFormData({
        node: 'pve',
        vmid: '',
        hostname: '',
        ostemplate: 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
        cores: '1',
        memory: '512',
        disk: '8',
        password: '',
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler beim Erstellen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Neuen Container erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen LXC-Container auf Ihrem Proxmox-Server
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node">Node</Label>
            <Input
              id="node"
              value={formData.node}
              onChange={(e) => setFormData({ ...formData, node: e.target.value })}
              placeholder="pve"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vmid">VMID</Label>
            <Input
              id="vmid"
              type="number"
              value={formData.vmid}
              onChange={(e) => setFormData({ ...formData, vmid: e.target.value })}
              placeholder="100"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hostname">Hostname</Label>
            <Input
              id="hostname"
              value={formData.hostname}
              onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              placeholder="my-container"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ostemplate">OS Template</Label>
            <Input
              id="ostemplate"
              value={formData.ostemplate}
              onChange={(e) => setFormData({ ...formData, ostemplate: e.target.value })}
              placeholder="local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cores">CPU Cores</Label>
              <Input
                id="cores"
                type="number"
                value={formData.cores}
                onChange={(e) => setFormData({ ...formData, cores: e.target.value })}
                min="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memory">RAM (MB)</Label>
              <Input
                id="memory"
                type="number"
                value={formData.memory}
                onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                min="256"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disk">Disk (GB)</Label>
            <Input
              id="disk"
              type="number"
              value={formData.disk}
              onChange={(e) => setFormData({ ...formData, disk: e.target.value })}
              min="2"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Root Passwort (optional)</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Sicheres Passwort"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
