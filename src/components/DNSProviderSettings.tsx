import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff } from "lucide-react";
import { dnsService } from "@/services/dns.service";
import { settingsService } from "@/services/settings.service";

export const DNSProviderSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showHetznerKey, setShowHetznerKey] = useState(false);
  const [showAutoDNSPassword, setShowAutoDNSPassword] = useState(false);
  
  const [hetznerKey, setHetznerKey] = useState("");
  const [autodnsUser, setAutodnsUser] = useState("");
  const [autodnsPassword, setAutodnsPassword] = useState("");
  const [autodnsContext, setAutodnsContext] = useState("");

  const { isLoading } = useQuery({
    queryKey: ['dns-settings'],
    queryFn: async () => {
      try {
        // Fetch Hetzner API Key
        const hetznerData = await settingsService.getSetting('hetzner_api_key');
        if (hetznerData?.value) {
          setHetznerKey(hetznerData.value);
        }
      } catch (error) {
        // Setting doesn't exist yet
      }

      try {
        // Fetch AutoDNS Credentials
        const autodnsData = await settingsService.getSetting('autodns_credentials');
        if (autodnsData?.value) {
          const creds = JSON.parse(autodnsData.value);
          setAutodnsUser(creds.username || '');
          setAutodnsPassword(creds.password || '');
          setAutodnsContext(creds.context || '');
        }
      } catch (error) {
        // Setting doesn't exist yet
      }

      return true;
    },
  });

  const saveHetznerMutation = useMutation({
    mutationFn: async () => {
      if (!hetznerKey) {
        throw new Error('API Key darf nicht leer sein');
      }
      return await dnsService.saveHetznerApiKey(hetznerKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-settings'] });
      toast({
        title: "Erfolg",
        description: "Hetzner API Key wurde verschlüsselt gespeichert",
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

  const saveAutoDNSMutation = useMutation({
    mutationFn: async () => {
      if (!autodnsUser || !autodnsPassword || !autodnsContext) {
        throw new Error('Alle Felder müssen ausgefüllt sein');
      }
      return await dnsService.saveAutoDNSCredentials(autodnsUser, autodnsPassword, autodnsContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-settings'] });
      toast({
        title: "Erfolg",
        description: "AutoDNS Credentials wurden verschlüsselt gespeichert",
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Lade Einstellungen...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hetzner DNS / Cloud API</CardTitle>
          <CardDescription>
            API Key für Hetzner Cloud und DNS Management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="hetzner-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="hetzner-key"
                  type={showHetznerKey ? "text" : "password"}
                  placeholder="Hetzner API Key"
                  value={hetznerKey}
                  onChange={(e) => setHetznerKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowHetznerKey(!showHetznerKey)}
                >
                  {showHetznerKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              🔒 Wird AES-256 verschlüsselt gespeichert
            </p>
          </div>
          <Button
            onClick={() => saveHetznerMutation.mutate()}
            disabled={!hetznerKey || saveHetznerMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Speichern
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AutoDNS API</CardTitle>
          <CardDescription>
            Credentials für AutoDNS Domain-Management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="autodns-user">API Benutzer</Label>
            <Input
              id="autodns-user"
              placeholder="AutoDNS API User"
              value={autodnsUser}
              onChange={(e) => setAutodnsUser(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="autodns-password">API Passwort</Label>
            <div className="relative">
              <Input
                id="autodns-password"
                type={showAutoDNSPassword ? "text" : "password"}
                placeholder="AutoDNS API Password"
                value={autodnsPassword}
                onChange={(e) => setAutodnsPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowAutoDNSPassword(!showAutoDNSPassword)}
              >
                {showAutoDNSPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="autodns-context">API Context</Label>
            <Input
              id="autodns-context"
              placeholder="z.B. 4"
              value={autodnsContext}
              onChange={(e) => setAutodnsContext(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Meist eine Nummer (z.B. 4 für Produktivsystem) 🔒 Wird AES-256 verschlüsselt
            </p>
          </div>
          <Button
            onClick={() => saveAutoDNSMutation.mutate()}
            disabled={!autodnsUser || !autodnsPassword || !autodnsContext || saveAutoDNSMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
