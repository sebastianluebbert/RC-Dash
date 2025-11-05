import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VncScreen } from 'react-vnc';

interface VNCConsoleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: string;
  vmid: number;
  type: 'qemu' | 'lxc';
  name: string;
}

export function VNCConsole({ open, onOpenChange, node, vmid, type, name }: VNCConsoleProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [vncUrl, setVncUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setVncUrl(null);
      return;
    }

    const connectVNC = async () => {
      setIsConnecting(true);

      try {
        console.log(`Connecting VNC for ${type} ${vmid} on node ${node}`);
        
        // Build WebSocket URL to our proxy
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const supabaseProjectId = import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0];
        const wsUrl = `${wsProtocol}//nusmxbpzundlplmohlrm.supabase.co/functions/v1/proxmox-vnc-proxy?node=${node}&vmid=${vmid}&type=${type}`;
        
        console.log('WebSocket proxy URL:', wsUrl);
        
        setVncUrl(wsUrl);
        setIsConnecting(false);

      } catch (error) {
        console.error('VNC connection error:', error);
        toast({
          title: "VNC Verbindung fehlgeschlagen",
          description: error instanceof Error ? error.message : "Unbekannter Fehler",
          variant: "destructive",
        });
        setIsConnecting(false);
        onOpenChange(false);
      }
    };

    connectVNC();
  }, [open, node, vmid, type, toast, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle>VNC Console: {name}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            VNC console connection for {name}
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full bg-black" style={{ height: 'calc(95vh - 80px)' }}>
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verbinde zu VNC...</p>
              </div>
            </div>
          )}
          {vncUrl && (
            <VncScreen
              url={vncUrl}
              scaleViewport
              background="#000000"
              style={{
                width: '100%',
                height: '100%',
              }}
              onConnect={() => {
                console.log('VNC connected');
                setIsConnecting(false);
              }}
              onDisconnect={() => {
                console.log('VNC disconnected');
                toast({
                  title: "VNC Verbindung getrennt",
                  description: "Die Verbindung wurde getrennt",
                });
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
