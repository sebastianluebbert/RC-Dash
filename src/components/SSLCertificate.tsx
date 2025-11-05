import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { sslService } from "@/services/ssl.service";
import { Shield, RefreshCw, CheckCircle, AlertTriangle, Clock, Server } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const SSLCertificate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRenewing, setIsRenewing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const { data: sslStatus, isLoading } = useQuery({
    queryKey: ['ssl-status'],
    queryFn: async () => {
      return await sslService.getStatus();
    },
  });

  const { data: renewalHistory } = useQuery({
    queryKey: ['ssl-history'],
    queryFn: async () => {
      return await sslService.getRenewalHistory();
    },
    enabled: sslStatus?.enabled === true,
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      setIsRenewing(true);
      return await sslService.renewCertificate();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssl-status'] });
      queryClient.invalidateQueries({ queryKey: ['ssl-history'] });
      setIsRenewing(false);
      toast({
        title: "Zertifikat erneuert",
        description: "Das SSL-Zertifikat wurde erfolgreich erneuert",
      });
    },
    onError: (error: any) => {
      setIsRenewing(false);
      toast({
        title: "Fehler",
        description: error?.response?.data?.details || "Zertifikat konnte nicht erneuert werden",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      setIsTesting(true);
      return await sslService.testConfiguration();
    },
    onSuccess: (data) => {
      setIsTesting(false);
      const nginxOk = data.nginxConfiguration === 'valid';
      const certOk = data.certificateValidity === 'valid (30+ days)';
      
      toast({
        title: nginxOk && certOk ? "Tests erfolgreich" : "Warnung",
        description: `Nginx: ${data.nginxConfiguration}, Zertifikat: ${data.certificateValidity}`,
        variant: nginxOk && certOk ? "default" : "destructive",
      });
    },
    onError: () => {
      setIsTesting(false);
      toast({
        title: "Fehler",
        description: "Tests konnten nicht durchgeführt werden",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sslStatus?.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SSL-Zertifikat
          </CardTitle>
          <CardDescription>
            SSL ist aktuell nicht konfiguriert
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>SSL nicht konfiguriert</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{sslStatus?.message || 'Führen Sie das Setup-Script aus, um SSL zu aktivieren.'}</p>
              <div className="mt-4">
                <code className="block bg-muted p-4 rounded-md text-sm">
                  sudo ./setup-ssl.sh
                </code>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const cert = sslStatus.certificate;
  const daysUntilExpiry = cert?.daysRemaining || 0;
  const isExpiringSoon = daysUntilExpiry < 30;
  const isExpired = daysUntilExpiry < 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                SSL-Zertifikat
              </CardTitle>
              <CardDescription>
                Let's Encrypt SSL-Zertifikat für {cert?.domain}
              </CardDescription>
            </div>
            <Badge variant={isExpired ? "destructive" : isExpiringSoon ? "default" : "secondary"}>
              {isExpired ? "Abgelaufen" : isExpiringSoon ? "Läuft bald ab" : "Aktiv"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Certificate Status Alert */}
          {(sslStatus.needsRenewal || isExpired) && (
            <Alert variant={isExpired ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {isExpired ? "Zertifikat abgelaufen!" : "Zertifikat sollte erneuert werden"}
              </AlertTitle>
              <AlertDescription>
                {isExpired 
                  ? "Das SSL-Zertifikat ist abgelaufen. Bitte erneuern Sie es sofort."
                  : `Das Zertifikat läuft in ${daysUntilExpiry} Tagen ab. Es wird empfohlen, es bald zu erneuern.`
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Certificate Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Domain</p>
                <p className="text-base font-mono">{cert?.domain}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aussteller</p>
                <p className="text-base">{cert?.issuer}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gültig von</p>
                <p className="text-base">{cert?.validFrom}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gültig bis</p>
                <p className="text-base">{cert?.validTo}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Verbleibende Tage</p>
                <p className={`text-2xl font-bold ${isExpiringSoon ? 'text-destructive' : 'text-green-500'}`}>
                  {daysUntilExpiry > 0 ? daysUntilExpiry : 0}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Automatische Erneuerung</p>
                <div className="flex items-center gap-2">
                  {cert?.autoRenewalEnabled ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-base">Aktiviert</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-base">Deaktiviert</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button
              onClick={() => renewMutation.mutate()}
              disabled={isRenewing}
              variant="default"
            >
              {isRenewing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Erneuere...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Jetzt erneuern
                </>
              )}
            </Button>
            
            <Button
              onClick={() => testMutation.mutate()}
              disabled={isTesting}
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Server className="mr-2 h-4 w-4 animate-pulse" />
                  Teste...
                </>
              ) : (
                <>
                  <Server className="mr-2 h-4 w-4" />
                  Konfiguration testen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Renewal History */}
      {renewalHistory && renewalHistory.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Erneuerungs-Verlauf
            </CardTitle>
            <CardDescription>
              Historie der automatischen und manuellen Zertifikat-Erneuerungen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renewalHistory.entries.slice(0, 10).map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">
                        {entry.timestamp}
                      </TableCell>
                      <TableCell>{entry.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {renewalHistory.total > 10 && (
              <p className="text-sm text-muted-foreground mt-2">
                Zeige die letzten 10 von {renewalHistory.total} Einträgen
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>ℹ️ Über Let's Encrypt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Let's Encrypt ist eine kostenlose, automatisierte und offene Zertifizierungsstelle.
          </p>
          <p>
            Zertifikate sind 90 Tage gültig und werden automatisch alle 60 Tage erneuert.
          </p>
          <p>
            Die automatische Erneuerung läuft täglich um 00:00 und 12:00 Uhr.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
