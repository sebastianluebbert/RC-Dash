import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff } from "lucide-react";

interface APISettings {
  hetzner_api_key?: string;
  autodns_user?: string;
  autodns_password?: string;
  autodns_context?: string;
}

export const DNSProviderSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showHetznerKey, setShowHetznerKey] = useState(false);
  const [showAutoDNSPassword, setShowAutoDNSPassword] = useState(false);
  
  const [hetznerKey, setHetznerKey] = useState("");
  const [autodnsUser, setAutodnsUser] = useState("");
  const [autodnsPassword, setAutodnsPassword] = useState("");
  const [autodnsContext, setAutodnsContext] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ['dns-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_settings')
        .select('*')
        .in('key', ['hetzner_api_key', 'autodns_credentials']);
      
      if (error) throw error;
      
      const hetznerSetting = data?.find(s => s.key === 'hetzner_api_key');
      const autodnsSetting = data?.find(s => s.key === 'autodns_credentials');
      
      // Decrypt values if encrypted
      if (hetznerSetting?.is_encrypted && hetznerSetting?.value_encrypted) {
        const { data: decrypted } = await supabase
          .rpc('decrypt_value', { encrypted_text: hetznerSetting.value_encrypted });
        if (decrypted) setHetznerKey(decrypted);
      } else if (hetznerSetting?.value) {
        setHetznerKey(hetznerSetting.value as string);
      }
      
      if (autodnsSetting?.is_encrypted && autodnsSetting?.value_encrypted) {
        const { data: decrypted } = await supabase
          .rpc('decrypt_value', { encrypted_text: autodnsSetting.value_encrypted });
        if (decrypted) {
          const creds = JSON.parse(decrypted);
          setAutodnsUser(creds.user || '');
          setAutodnsPassword(creds.password || '');
          setAutodnsContext(creds.context || '');
        }
      } else if (autodnsSetting?.value) {
        const creds = autodnsSetting.value as any;
        setAutodnsUser(creds.user || '');
        setAutodnsPassword(creds.password || '');
        setAutodnsContext(creds.context || '');
      }
      
      return {
        hetzner: hetznerSetting,
        autodns: autodnsSetting,
      };
    },
  });

  const saveHetznerMutation = useMutation({
    mutationFn: async () => {
      if (!hetznerKey) {
        throw new Error('API Key darf nicht leer sein');
      }

      // Encrypt the API key
      const { data: encryptedKey, error: encryptError } = await supabase
        .rpc('encrypt_value', { plain_text: hetznerKey });

      if (encryptError) throw encryptError;

      const { data: existing } = await supabase
        .from('application_settings')
        .select('id')
        .eq('key', 'hetzner_api_key')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('application_settings')
          .update({ 
            value_encrypted: encryptedKey,
            is_encrypted: true 
          })
          .eq('key', 'hetzner_api_key');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('application_settings')
          .insert({
            key: 'hetzner_api_key',
            value: '' as any, // Dummy value for backward compatibility
            value_encrypted: encryptedKey,
            is_encrypted: true,
            description: 'Hetzner Cloud API Key (encrypted)',
          });
        if (error) throw error;
      }
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

      const credentials = {
        user: autodnsUser,
        password: autodnsPassword,
        context: autodnsContext,
      };

      // Encrypt the credentials
      const { data: encryptedCreds, error: encryptError } = await supabase
        .rpc('encrypt_value', { plain_text: JSON.stringify(credentials) });

      if (encryptError) throw encryptError;

      const { data: existing } = await supabase
        .from('application_settings')
        .select('id')
        .eq('key', 'autodns_credentials')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('application_settings')
          .update({
            value_encrypted: encryptedCreds,
            is_encrypted: true,
          })
          .eq('key', 'autodns_credentials');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('application_settings')
          .insert({
            key: 'autodns_credentials',
            value: {} as any, // Dummy value for backward compatibility
            value_encrypted: encryptedCreds,
            is_encrypted: true,
            description: 'AutoDNS API Credentials (encrypted)',
          });
        if (error) throw error;
      }
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
