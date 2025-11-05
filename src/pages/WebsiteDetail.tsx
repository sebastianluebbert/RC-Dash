import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { 
  ArrowLeft, 
  ExternalLink, 
  Loader2, 
  Code, 
  Globe, 
  Server, 
  User, 
  Mail, 
  Building, 
  Home,
  Shield,
  Network,
  Database,
  Settings,
  FileCode,
  Check,
  X,
  AlertCircle,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Website {
  id: number;
  name: string;
  status?: string;
  hasWordPress: boolean;
  hosting_type?: string;
  serverId: string;
  serverName: string;
  client?: {
    id: number;
    name: string;
    company?: string;
    email?: string;
  };
  wordpress?: {
    id: number;
    version: string;
    url: string;
  };
}

const WebsiteDetail = () => {
  const { serverId, websiteId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingSso, setLoadingSso] = useState(false);

  const { data: website, isLoading } = useQuery({
    queryKey: ['website-detail', serverId, websiteId],
    queryFn: async () => {
      if (!serverId || !websiteId) return null;

      const { data: server } = await supabase
        .from('plesk_servers')
        .select('*')
        .eq('id', serverId)
        .maybeSingle();

      if (!server) throw new Error('Server nicht gefunden');

      const { data, error } = await supabase.functions.invoke('plesk-websites', {
        body: { serverId: server.id },
      });

      if (error) throw error;

      const websites = data?.websites || [];
      const website = websites.find((w: Website) => w.id.toString() === websiteId);

      if (!website) throw new Error('Website nicht gefunden');

      return {
        ...website,
        serverId: server.id,
        serverName: server.name,
        serverHost: server.host,
      };
    },
    enabled: !!serverId && !!websiteId,
  });

  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ['website-details', serverId, websiteId],
    queryFn: async () => {
      if (!serverId || !websiteId) return null;

      const { data, error } = await supabase.functions.invoke('plesk-website-details', {
        body: { 
          serverId: serverId,
          domainId: parseInt(websiteId),
        },
      });

      if (error) {
        console.error('Error fetching website details:', error);
        throw error;
      }
      
      console.log('Website details loaded:', data);
      return data;
    },
    enabled: !!serverId && !!websiteId,
  });

  const handleWordPressSso = async () => {
    if (!website?.wordpress?.id) return;

    setLoadingSso(true);
    try {
      const { data, error } = await supabase.functions.invoke('plesk-wp-sso', {
        body: {
          serverId: website.serverId,
          installationId: website.wordpress.id,
        },
      });

      if (error) throw error;

      window.open(data.ssoUrl, '_blank');

      toast({
        title: "WordPress Admin geöffnet",
        description: "Du wurdest automatisch angemeldet.",
      });
    } catch (error: any) {
      toast({
        title: "SSO fehlgeschlagen",
        description: error.message || "Konnte WordPress Admin nicht öffnen.",
        variant: "destructive",
      });
    } finally {
      setLoadingSso(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-12">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (!website) {
    return (
      <main className="flex-1 p-12">
        <Card>
          <CardHeader>
            <CardTitle>Website nicht gefunden</CardTitle>
            <CardDescription>
              Die angeforderte Website konnte nicht gefunden werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/websites')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zur Übersicht
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 p-12">
      <div className="space-y-8 max-w-4xl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="flex items-center gap-1">
                <Home className="h-4 w-4" />
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/websites">Websites</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{website.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/websites')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">{website.name}</h1>
            <p className="mt-2 text-muted-foreground">Website Details</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="ssl">SSL/TLS</TabsTrigger>
            <TabsTrigger value="dns">DNS</TabsTrigger>
            <TabsTrigger value="databases">Datenbanken</TabsTrigger>
            <TabsTrigger value="hosting">Hosting</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Allgemeine Informationen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Allgemeine Informationen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Domain</p>
                  <p className="font-medium">{website.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={website.status === 'active' ? 'default' : 'secondary'}>
                    {website.status || 'unbekannt'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hosting-Typ</p>
                  <Badge variant="outline">{website.hosting_type || 'unbekannt'}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Website-ID</p>
                  <p className="font-mono text-sm">{website.id}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://${website.name}`, '_blank')}
                  className="w-full sm:w-auto"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Website öffnen
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Server-Informationen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Server-Informationen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Server-Name</p>
                  <p className="font-medium">{website.serverName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Server-Host</p>
                  <p className="font-mono text-sm">{website.serverHost}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kunden-Informationen */}
          {website.client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Kunden-Informationen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{website.client.name}</p>
                  </div>
                  {website.client.company && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        Firma
                      </p>
                      <p className="font-medium">{website.client.company}</p>
                    </div>
                  )}
                  {website.client.email && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        E-Mail
                      </p>
                      <p className="font-medium">{website.client.email}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* WordPress-Informationen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                WordPress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {website.hasWordPress && website.wordpress ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant="default" className="bg-green-500">
                        WordPress installiert
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="font-medium">{website.wordpress.version}</p>
                    </div>
                    {website.wordpress.url && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">URL</p>
                        <p className="font-mono text-sm">{website.wordpress.url}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <Button
                      onClick={handleWordPressSso}
                      disabled={loadingSso}
                      className="w-full sm:w-auto"
                    >
                      {loadingSso ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Code className="mr-2 h-4 w-4" />
                      )}
                      WordPress Admin öffnen (SSO)
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Keine WordPress-Installation gefunden
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ssl" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                SSL/TLS-Zertifikate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : details?.sslCertificates && details.sslCertificates.length > 0 ? (
                <div className="space-y-4">
                  {details.sslCertificates.map((cert: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className={`h-5 w-5 ${cert.is_valid ? 'text-green-500' : 'text-red-500'}`} />
                          <span className="font-medium">{cert.name || 'SSL-Zertifikat'}</span>
                        </div>
                        <Badge variant={cert.is_valid ? 'default' : 'destructive'}>
                          {cert.is_valid ? 'Gültig' : 'Ungültig'}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {cert.issuer_name && (
                          <div>
                            <p className="text-muted-foreground">Aussteller</p>
                            <p className="font-medium">{cert.issuer_name}</p>
                          </div>
                        )}
                        {cert.valid_from && (
                          <div>
                            <p className="text-muted-foreground">Gültig ab</p>
                            <p className="font-medium">{new Date(cert.valid_from).toLocaleDateString('de-DE')}</p>
                          </div>
                        )}
                        {cert.valid_to && (
                          <div>
                            <p className="text-muted-foreground">Gültig bis</p>
                            <p className="font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(cert.valid_to).toLocaleDateString('de-DE')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine SSL-Zertifikate gefunden</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dns" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                DNS-Einträge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : details?.dnsRecords && details.dnsRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Typ</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Wert</TableHead>
                      <TableHead>TTL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.dnsRecords.map((record: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline">{record.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{record.host || '@'}</TableCell>
                        <TableCell className="font-mono text-sm max-w-md truncate">
                          {record.value}
                        </TableCell>
                        <TableCell>{record.ttl || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine DNS-Einträge gefunden</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="databases" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Datenbanken
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : details?.databases && details.databases.length > 0 ? (
                <div className="space-y-4">
                  {details.databases.map((db: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-5 w-5 text-primary" />
                          <span className="font-medium font-mono">{db.name}</span>
                        </div>
                        <Badge>{db.type || 'MySQL'}</Badge>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {db.server_id && (
                          <div>
                            <p className="text-muted-foreground">Server ID</p>
                            <p className="font-mono">{db.server_id}</p>
                          </div>
                        )}
                        {db.disk_usage && (
                          <div>
                            <p className="text-muted-foreground">Speicherplatz</p>
                            <p className="font-medium">{(db.disk_usage / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine Datenbanken gefunden</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hosting" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Hosting-Einstellungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : details?.domain ? (
                <div className="space-y-6">
                  {/* IP-Adressen */}
                  {(details.domain.ipv4 || details.domain.ipv6) && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Network className="h-4 w-4" />
                        IP-Adressen
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {details.domain.ipv4 && details.domain.ipv4.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">IPv4</p>
                            {details.domain.ipv4.map((ip: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="font-mono mr-2">
                                {ip}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {details.domain.ipv6 && details.domain.ipv6.length > 0 && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">IPv6</p>
                            {details.domain.ipv6.map((ip: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="font-mono mr-2">
                                {ip}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Hosting-Details */}
                  {details.hostingSettings && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        Technische Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {details.hostingSettings.php_version && (
                          <div>
                            <p className="text-sm text-muted-foreground">PHP-Version</p>
                            <p className="font-medium">{details.hostingSettings.php_version}</p>
                          </div>
                        )}
                        {details.hostingSettings.web_server && (
                          <div>
                            <p className="text-sm text-muted-foreground">Web-Server</p>
                            <p className="font-medium">{details.hostingSettings.web_server}</p>
                          </div>
                        )}
                        {details.hostingSettings.ftp_login && (
                          <div>
                            <p className="text-sm text-muted-foreground">FTP-Login</p>
                            <p className="font-mono text-sm">{details.hostingSettings.ftp_login}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Plan-Informationen */}
                  {details.domain.plan && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">Hosting-Plan</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Plan-Name</p>
                            <p className="font-medium">{details.domain.plan.name}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine Hosting-Informationen verfügbar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </main>
  );
};

export default WebsiteDetail;
