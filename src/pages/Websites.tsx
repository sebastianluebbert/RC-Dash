import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ExternalLink, Loader2, Globe, Code, RefreshCw, Search, Filter, ChevronDown, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";

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

interface PleskServer {
  id: string;
  name: string;
  host: string;
}

const SERVER_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-red-500",
];

const Websites = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [serverFilter, setServerFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingSso, setLoadingSso] = useState<string | null>(null);
  const [viewMode, setViewMode] = useViewMode("websites-view-mode");

  const { data: servers, isLoading: serversLoading } = useQuery({
    queryKey: ['plesk-servers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('plesk-servers');
      if (error) throw error;
      return data.servers as PleskServer[];
    },
  });

  const { data: allWebsites, isLoading: websitesLoading, refetch: refetchWebsites } = useQuery({
    queryKey: ['plesk-all-websites'],
    queryFn: async () => {
      if (!servers || servers.length === 0) return [];
      
      const results = await Promise.all(
        servers.map(async (server) => {
          try {
            const { data, error } = await supabase.functions.invoke('plesk-websites', {
              body: { serverId: server.id },
            });
            if (error) throw error;
            return (data?.websites || []).map((website: any) => ({
              ...website,
              serverId: server.id,
              serverName: server.name,
            }));
          } catch (error) {
            console.error(`Error fetching websites for ${server.name}:`, error);
            return [];
          }
        })
      );
      
      return results.flat();
    },
    enabled: !!servers && servers.length > 0,
  });

  const handleWordPressSso = async (website: Website) => {
    if (!website.wordpress?.id) return;

    setLoadingSso(website.wordpress.id.toString());
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
      setLoadingSso(null);
    }
  };

  const handleRefresh = () => {
    refetchWebsites();
    toast({ title: "Aktualisiert", description: "Daten wurden neu geladen" });
  };

  const getServerColor = (serverId: string) => {
    const index = servers?.findIndex(s => s.id === serverId) || 0;
    return SERVER_COLORS[index % SERVER_COLORS.length];
  };

  const filteredWebsites = useMemo(() => {
    if (!allWebsites) return [];
    
    return allWebsites.filter(website => {
      const matchesServer = serverFilter === "all" || website.serverId === serverFilter;
      const matchesSearch = searchQuery === "" || 
        website.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        website.client?.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesServer && matchesSearch;
    });
  }, [allWebsites, serverFilter, searchQuery]);

  const groupedByClient = useMemo(() => {
    const groups = new Map<string, Website[]>();
    
    filteredWebsites.forEach(website => {
      const clientKey = website.client ? `${website.client.id}-${website.client.name}` : 'keine-zuordnung';
      const clientName = website.client?.name || 'Keine Kundenzuordnung';
      
      if (!groups.has(clientKey)) {
        groups.set(clientKey, []);
      }
      groups.get(clientKey)!.push(website);
    });
    
    return Array.from(groups.entries()).map(([key, websites]) => ({
      key,
      name: websites[0].client?.name || 'Keine Kundenzuordnung',
      client: websites[0].client,
      websites,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredWebsites]);

  const wordpressCount = filteredWebsites.filter(w => w.hasWordPress).length;

  if (serversLoading) {
    return (
      <main className="flex-1 p-12">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (!servers || servers.length === 0) {
    return (
      <main className="flex-1 p-12">
        <Card>
          <CardHeader>
            <CardTitle>Keine Plesk-Server konfiguriert</CardTitle>
            <CardDescription>
              Füge zuerst einen Plesk-Server in den Einstellungen hinzu.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 p-12">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Websites</h1>
            <p className="mt-2 text-muted-foreground">Plesk Website Verwaltung</p>
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Aktualisieren
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <Label>Plesk Server</Label>
              <Select value={serverFilter} onValueChange={setServerFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Server</SelectItem>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Suche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Website-Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Websites</CardTitle>
            <CardDescription>
              {filteredWebsites.length} Websites gefunden ({wordpressCount} mit WordPress)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {websitesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : groupedByClient.length > 0 ? (
              <Accordion type="multiple" defaultValue={groupedByClient.map(g => g.key)} className="space-y-4">
                {groupedByClient.map((group) => (
                  <AccordionItem key={group.key} value={group.key} className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div className="flex flex-col items-start">
                          <span className="font-semibold text-lg">{group.name}</span>
                          {group.client?.company && (
                            <span className="text-sm text-muted-foreground">{group.client.company}</span>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-auto mr-2">
                          {group.websites.length} {group.websites.length === 1 ? 'Website' : 'Websites'}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {viewMode === "list" ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Website</TableHead>
                              <TableHead>Server</TableHead>
                              <TableHead>Typ</TableHead>
                              <TableHead>WordPress</TableHead>
                              <TableHead>Aktionen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.websites.map((website) => (
                      <TableRow 
                        key={`${website.serverId}-${website.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/websites/${website.serverId}/${website.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{website.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getServerColor(website.serverId)}>
                            {website.serverName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {website.hosting_type || 'unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {website.hasWordPress ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Code className="h-4 w-4 text-green-500" />
                              <span>WordPress {website.wordpress?.version}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {website.hasWordPress && website.wordpress && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWordPressSso(website);
                                }}
                                disabled={loadingSso === website.wordpress.id.toString()}
                              >
                                {loadingSso === website.wordpress.id.toString() ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Code className="mr-1 h-4 w-4" />
                                    WP Admin
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : viewMode === "compact" ? (
                        <div className="space-y-2 p-4">
                          {group.websites.map((website) => (
                    <Card 
                      key={`${website.serverId}-${website.id}`} 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/websites/${website.serverId}/${website.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{website.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`${getServerColor(website.serverId)} text-xs`}>
                                {website.serverName}
                              </Badge>
                              {website.hasWordPress && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Code className="h-3 w-3" />
                                  WordPress {website.wordpress?.version}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {website.hasWordPress && website.wordpress && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWordPressSso(website);
                              }}
                              disabled={loadingSso === website.wordpress.id.toString()}
                            >
                              {loadingSso === website.wordpress.id.toString() ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Code className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4">
                          {group.websites.map((website) => (
                    <Card 
                      key={`${website.serverId}-${website.id}`}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/websites/${website.serverId}/${website.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <CardTitle className="text-lg truncate">{website.name}</CardTitle>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getServerColor(website.serverId)}>
                            {website.serverName}
                          </Badge>
                          {website.hosting_type && (
                            <Badge variant="outline">
                              {website.hosting_type}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-2">
                          {website.hasWordPress ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Code className="h-4 w-4 text-green-500" />
                              WordPress {website.wordpress?.version}
                            </div>
                          ) : (
                            <span className="text-sm">Keine WordPress-Installation</span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {website.hasWordPress && website.wordpress && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWordPressSso(website);
                            }}
                            disabled={loadingSso === website.wordpress.id.toString()}
                          >
                            {loadingSso === website.wordpress.id.toString() ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Wird geöffnet...
                              </>
                            ) : (
                              <>
                                <Code className="mr-2 h-4 w-4" />
                                WordPress Admin (SSO)
                              </>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                      ))}
                    </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Keine Websites gefunden
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Websites;
