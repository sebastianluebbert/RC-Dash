import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ViewToggle } from "@/components/ViewToggle";
import { useViewMode } from "@/hooks/useViewMode";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Zone {
  id: number | string;
  name: string;
  ttl: number;
  created: string;
  mode: string;
  status: string;
  record_count: number;
  authoritative_nameservers: {
    assigned: string[];
    delegated: string[];
    delegation_status: string;
  };
  registrar: string;
  provider?: string;
}

const Domains = () => {
  const [viewMode, setViewMode] = useViewMode("domains-view-mode");
  
  const { data: hetznerZones, isLoading: hetznerLoading } = useQuery({
    queryKey: ["hetzner-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("hetzner-zones");
      if (error) throw error;
      return data;
    },
  });

  const { data: autodnsZones, isLoading: autodnsLoading } = useQuery({
    queryKey: ["autodns-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("autodns-zones");
      if (error) {
        console.error("AutoDNS error:", error);
        return { zones: [] }; // Return empty if AutoDNS fails
      }
      return data;
    },
  });

  const isLoading = hetznerLoading || autodnsLoading;
  
  // Combine zones from both providers
  const allZones = [
    ...(hetznerZones?.zones || []).map((zone: Zone) => ({ ...zone, provider: 'hetzner' })),
    ...(autodnsZones?.zones || [])
  ];

  const zonesData = { zones: allZones };

  return (
    <main className="flex-1 p-12">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Domains</h1>
            <p className="mt-2 text-muted-foreground">
              Verwalten Sie Ihre Hetzner DNS Zonen und Einträge
            </p>
          </div>
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {zonesData?.zones && zonesData.zones.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Keine DNS-Zonen gefunden</CardTitle>
              <CardDescription>
                Erstellen Sie zuerst DNS-Zonen in Ihrer{" "}
                <a 
                  href="https://dns.hetzner.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Hetzner DNS Console
                </a>
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {zonesData?.zones && zonesData.zones.length > 0 && (
          viewMode === "list" ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>TTL</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Nameserver</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zonesData.zones.map((zone: Zone) => (
                    <TableRow key={zone.id}>
                      <TableCell>
                        <Badge 
                          variant={zone.provider === 'hetzner' ? 'destructive' : 'default'}
                          className={zone.provider === 'autodns' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        >
                          {zone.provider === 'hetzner' ? 'Hetzner' : 'AutoDNS'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{zone.name}</TableCell>
                      <TableCell>{zone.record_count}</TableCell>
                      <TableCell>{zone.ttl}s</TableCell>
                      <TableCell>
                        {new Date(zone.created).toLocaleDateString("de-DE")}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1 max-w-[200px]">
                          {zone.authoritative_nameservers.assigned.slice(0, 2).map((ns, idx) => (
                            <div key={idx} className="truncate">{ns}</div>
                          ))}
                          {zone.authoritative_nameservers.assigned.length > 2 && (
                            <div className="text-muted-foreground">
                              +{zone.authoritative_nameservers.assigned.length - 2} mehr
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/domains/dns?zone=${zone.id}&name=${zone.name}&provider=${zone.provider}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className={viewMode === "grid" ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "grid gap-4 md:grid-cols-2 lg:grid-cols-4"}>
              {zonesData.zones.map((zone: Zone) => (
                <Card key={zone.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className={viewMode === "compact" ? "pb-3" : ""}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {viewMode === "grid" && <Globe className="h-8 w-8 text-primary" />}
                        <Badge 
                          variant={zone.provider === 'hetzner' ? 'destructive' : 'default'}
                          className={zone.provider === 'autodns' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        >
                          {zone.provider === 'hetzner' ? 'Hetzner' : 'AutoDNS'}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/domains/dns?zone=${zone.id}&name=${zone.name}&provider=${zone.provider}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                    <CardTitle className={viewMode === "compact" ? "text-lg mt-2" : "mt-4"}>{zone.name}</CardTitle>
                    {viewMode === "grid" && (
                      <CardDescription>
                        {zone.record_count} DNS Einträge
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className={viewMode === "compact" ? "pb-3" : ""}>
                    {viewMode === "grid" ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TTL:</span>
                          <span className="font-medium">{zone.ttl}s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Erstellt:</span>
                          <span className="font-medium">
                            {new Date(zone.created).toLocaleDateString("de-DE")}
                          </span>
                        </div>
                        <div className="mt-4">
                          <span className="text-muted-foreground text-xs">Nameserver:</span>
                          <div className="mt-1 space-y-1">
                            {zone.authoritative_nameservers.assigned.map((ns, idx) => (
                              <div key={idx} className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                {ns}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{zone.record_count} Einträge</span>
                        <span className="text-muted-foreground">{zone.ttl}s TTL</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </main>
  );
};

export default Domains;
