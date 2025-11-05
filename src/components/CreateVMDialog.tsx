import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateVMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultNode?: string;
}

export function CreateVMDialog({ open, onOpenChange, onSuccess, defaultNode }: CreateVMDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    node: defaultNode || 'pve',
    vmid: '',
    name: '',
    cores: '2',
    memory: '2048',
    disk: '32',
    ostype: 'l26',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxmox-create-vm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            node: data.node,
            vmid: parseInt(data.vmid),
            name: data.name,
            cores: parseInt(data.cores),
            memory: parseInt(data.memory),
            disk: parseInt(data.disk),
            ostype: data.ostype,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create VM');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "VM wird erstellt",
        description: "Die VM wird auf Ihrem Proxmox-Server erstellt",
      });
      onSuccess();
      setFormData({
        node: 'pve',
        vmid: '',
        name: '',
        cores: '2',
        memory: '2048',
        disk: '32',
        ostype: 'l26',
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
          <DialogTitle>Neue VM erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue virtuelle Maschine auf Ihrem Proxmox-Server
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
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="my-vm"
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
                min="512"
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
              min="8"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ostype">OS Type</Label>
            <Select value={formData.ostype} onValueChange={(value) => setFormData({ ...formData, ostype: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="l26">Linux Kernel 2.6+</SelectItem>
                <SelectItem value="win11">Windows 11</SelectItem>
                <SelectItem value="win10">Windows 10</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
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
