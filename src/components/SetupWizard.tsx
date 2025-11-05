import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Server, 
  Mail, 
  Globe, 
  Cloud,
  Rocket,
  X
} from "lucide-react";
import { proxmoxService } from "@/services/proxmox.service";
import { dnsService } from "@/services/dns.service";
import { mailService } from "@/services/mail.service";
import { settingsService } from "@/services/settings.service";

interface SetupWizardProps {
  open: boolean;
  onClose: () => void;
}

interface ProxmoxServerData {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

interface DnsProviderData {
  provider: 'hetzner' | 'autodns';
  hetznerApiKey?: string;
  autodnsUsername?: string;
  autodnsPassword?: string;
  autodnsContext?: string;
}

interface MailServerData {
  name: string;
  host: string;
  apiKey: string;
}

export const SetupWizard = ({ open, onClose }: SetupWizardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Form data
  const [proxmoxData, setProxmoxData] = useState<ProxmoxServerData>({
    name: "",
    host: "",
    port: 8006,
    username: "root@pam",
    password: "",
  });

  const [dnsData, setDnsData] = useState<DnsProviderData>({
    provider: 'hetzner',
    hetznerApiKey: "",
  });

  const [mailData, setMailData] = useState<MailServerData>({
    name: "",
    host: "",
    apiKey: "",
  });

  const steps = [
    {
      id: 0,
      title: "Willkommen bei RexCloud",
      description: "Lassen Sie uns Ihre Infrastruktur einrichten",
      icon: Rocket,
      optional: false,
    },
    {
      id: 1,
      title: "Proxmox Server",
      description: "Verbinden Sie Ihren Proxmox Server",
      icon: Server,
      optional: true,
    },
    {
      id: 2,
      title: "DNS Provider",
      description: "Konfigurieren Sie Ihren DNS Provider",
      icon: Globe,
      optional: true,
    },
    {
      id: 3,
      title: "Mail Server",
      description: "Verbinden Sie Ihren Mailcow Server",
      icon: Mail,
      optional: true,
    },
    {
      id: 4,
      title: "Fertig!",
      description: "Setup abgeschlossen",
      icon: CheckCircle2,
      optional: false,
    },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleProxmoxSubmit = async () => {
    if (!proxmoxData.name || !proxmoxData.host || !proxmoxData.password) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte füllen Sie alle erforderlichen Felder aus",
        variant: "destructive",
      });
      return false;
    }

    try {
      await proxmoxService.addNode({
        name: proxmoxData.name,
        host: proxmoxData.host,
        port: proxmoxData.port,
        username: proxmoxData.username,
        password: proxmoxData.password,
        realm: proxmoxData.username.includes('@') ? proxmoxData.username.split('@')[1] : 'pam',
        verify_ssl: false,
      });

      setCompletedSteps([...completedSteps, 1]);
      toast({
        title: "Erfolg",
        description: "Proxmox Server wurde hinzugefügt",
      });
      return true;
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleDnsSubmit = async () => {
    try {
      if (dnsData.provider === 'hetzner' && !dnsData.hetznerApiKey) {
        toast({
          title: "Fehlende Informationen",
          description: "Bitte geben Sie Ihren Hetzner API Key ein",
          variant: "destructive",
        });
        return false;
      }

      if (dnsData.provider === 'hetzner') {
        await dnsService.saveHetznerApiKey(dnsData.hetznerApiKey!);
      } else {
        await dnsService.saveAutoDNSCredentials(
          dnsData.autodnsUsername || "",
          dnsData.autodnsPassword || "",
          dnsData.autodnsContext || ""
        );
      }

      setCompletedSteps([...completedSteps, 2]);
      toast({
        title: "Erfolg",
        description: "DNS Provider wurde konfiguriert",
      });
      return true;
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleMailSubmit = async () => {
    if (!mailData.name || !mailData.host || !mailData.apiKey) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte füllen Sie alle erforderlichen Felder aus",
        variant: "destructive",
      });
      return false;
    }

    try {
      await mailService.addServer({
        name: mailData.name,
        host: mailData.host,
        apiKey: mailData.apiKey,
      });

      setCompletedSteps([...completedSteps, 3]);
      toast({
        title: "Erfolg",
        description: "Mail Server wurde hinzugefügt",
      });
      return true;
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleNext = async () => {
    // Save current step if it's a configuration step
    if (currentStep === 1) {
      const success = await handleProxmoxSubmit();
      if (!success) return;
    } else if (currentStep === 2) {
      const success = await handleDnsSubmit();
      if (!success) return;
    } else if (currentStep === 3) {
      const success = await handleMailSubmit();
      if (!success) return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Mark setup as completed in localStorage
    localStorage.setItem('rexcloud_setup_completed', 'true');
    
    toast({
      title: "Setup abgeschlossen!",
      description: "Sie können nun RexCloud nutzen",
    });

    onClose();
    navigate('/');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 py-8 text-center">
            <div className="flex justify-center">
              <Rocket className="h-20 w-20 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">Willkommen bei RexCloud!</h3>
              <p className="text-muted-foreground">
                Dieser Assistent hilft Ihnen bei der Einrichtung Ihrer Infrastruktur.
                Sie können Schritte überspringen und später in den Einstellungen konfigurieren.
              </p>
            </div>
            <div className="grid gap-4 text-left max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <Server className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Proxmox Server</p>
                  <p className="text-sm text-muted-foreground">VM & Container Verwaltung</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">DNS Provider</p>
                  <p className="text-sm text-muted-foreground">Domain Verwaltung</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Mail Server</p>
                  <p className="text-sm text-muted-foreground">E-Mail Verwaltung</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Proxmox Server hinzufügen</h3>
              <Badge variant="secondary">Optional</Badge>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="proxmox-name">Name *</Label>
                <Input
                  id="proxmox-name"
                  placeholder="z.B. Proxmox-Node-1"
                  value={proxmoxData.name}
                  onChange={(e) => setProxmoxData({ ...proxmoxData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="proxmox-host">Host *</Label>
                <Input
                  id="proxmox-host"
                  placeholder="https://proxmox.example.com"
                  value={proxmoxData.host}
                  onChange={(e) => setProxmoxData({ ...proxmoxData, host: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="proxmox-port">Port</Label>
                <Input
                  id="proxmox-port"
                  type="number"
                  value={proxmoxData.port}
                  onChange={(e) => setProxmoxData({ ...proxmoxData, port: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="proxmox-username">Benutzername *</Label>
                <Input
                  id="proxmox-username"
                  placeholder="root@pam"
                  value={proxmoxData.username}
                  onChange={(e) => setProxmoxData({ ...proxmoxData, username: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="proxmox-password">Passwort *</Label>
                <Input
                  id="proxmox-password"
                  type="password"
                  value={proxmoxData.password}
                  onChange={(e) => setProxmoxData({ ...proxmoxData, password: e.target.value })}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">DNS Provider konfigurieren</h3>
              <Badge variant="secondary">Optional</Badge>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Provider auswählen</Label>
                <div className="flex gap-4 mt-2">
                  <Button
                    type="button"
                    variant={dnsData.provider === 'hetzner' ? 'default' : 'outline'}
                    onClick={() => setDnsData({ ...dnsData, provider: 'hetzner' })}
                  >
                    Hetzner DNS
                  </Button>
                  <Button
                    type="button"
                    variant={dnsData.provider === 'autodns' ? 'default' : 'outline'}
                    onClick={() => setDnsData({ ...dnsData, provider: 'autodns' })}
                  >
                    AutoDNS
                  </Button>
                </div>
              </div>

              {dnsData.provider === 'hetzner' && (
                <div>
                  <Label htmlFor="hetzner-api-key">Hetzner DNS API Key *</Label>
                  <Input
                    id="hetzner-api-key"
                    type="password"
                    placeholder="API Key"
                    value={dnsData.hetznerApiKey}
                    onChange={(e) => setDnsData({ ...dnsData, hetznerApiKey: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Erhalten Sie unter: https://dns.hetzner.com → API Tokens
                  </p>
                </div>
              )}

              {dnsData.provider === 'autodns' && (
                <>
                  <div>
                    <Label htmlFor="autodns-username">Benutzername *</Label>
                    <Input
                      id="autodns-username"
                      value={dnsData.autodnsUsername}
                      onChange={(e) => setDnsData({ ...dnsData, autodnsUsername: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="autodns-password">Passwort *</Label>
                    <Input
                      id="autodns-password"
                      type="password"
                      value={dnsData.autodnsPassword}
                      onChange={(e) => setDnsData({ ...dnsData, autodnsPassword: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="autodns-context">Context *</Label>
                    <Input
                      id="autodns-context"
                      value={dnsData.autodnsContext}
                      onChange={(e) => setDnsData({ ...dnsData, autodnsContext: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Mail Server hinzufügen</h3>
              <Badge variant="secondary">Optional</Badge>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mail-name">Name *</Label>
                <Input
                  id="mail-name"
                  placeholder="z.B. Mail-Server 1"
                  value={mailData.name}
                  onChange={(e) => setMailData({ ...mailData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="mail-host">Host (URL) *</Label>
                <Input
                  id="mail-host"
                  placeholder="https://mail.example.com"
                  value={mailData.host}
                  onChange={(e) => setMailData({ ...mailData, host: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="mail-apikey">API Key *</Label>
                <Input
                  id="mail-apikey"
                  type="password"
                  placeholder="Mailcow API Key"
                  value={mailData.apiKey}
                  onChange={(e) => setMailData({ ...mailData, apiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mailcow: Konfiguration → API
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 py-8 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="h-20 w-20 text-green-500" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">Setup abgeschlossen!</h3>
              <p className="text-muted-foreground">
                Sie haben {completedSteps.length} von {steps.length - 2} optionalen Diensten konfiguriert.
              </p>
            </div>
            <div className="space-y-2 text-left max-w-md mx-auto">
              {completedSteps.includes(1) && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Proxmox Server verbunden</span>
                </div>
              )}
              {completedSteps.includes(2) && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>DNS Provider konfiguriert</span>
                </div>
              )}
              {completedSteps.includes(3) && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Mail Server verbunden</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Weitere Dienste können Sie jederzeit in den Einstellungen hinzufügen.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>RexCloud Setup</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                localStorage.setItem('rexcloud_setup_completed', 'true');
                onClose();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Schritt {currentStep + 1} von {steps.length}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </DialogHeader>

        <div className="py-6">
          {renderStepContent()}
        </div>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>

          <div className="flex gap-2">
            {currentStep > 0 && currentStep < steps.length - 1 && (
              <Button variant="ghost" onClick={handleSkip}>
                Überspringen
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? 'Fertigstellen' : 'Weiter'}
              {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
