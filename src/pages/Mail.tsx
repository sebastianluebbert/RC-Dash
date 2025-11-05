import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail as MailIcon, Server, Loader2, RefreshCw, Plus, Pencil, Trash2, ExternalLink, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface MailServer {
  id: string;
  name: string;
  host: string;
  created_at: string;
}

interface Mailbox {
  username: string;
  name: string;
  domain: string;
  local_part: string;
  quota: number;
  quota_used: number;
  messages: number;
  active: number;
  serverId: string;
  serverName: string;
}

interface Domain {
  domain_name: string;
  description: string;
  aliases_in_domain: number;
  mboxes_in_domain: number;
  active: number;
  max_num_aliases_for_domain: number;
  max_num_mboxes_for_domain: number;
  max_quota_for_domain: number;
  serverId: string;
  serverName: string;
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

const Mail = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serverFilter, setServerFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [mailboxDialogOpen, setMailboxDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [selectedServerForAction, setSelectedServerForAction] = useState<string>("");
  
  const [domainForm, setDomainForm] = useState({
    domain_name: "",
    description: "",
    max_aliases: 400,
    max_mailboxes: 10,
    default_quota: 1073741824,
    max_quota: 10737418240,
    quota: 10737418240,
    active: true,
  });

  const [mailboxForm, setMailboxForm] = useState({
    local_part: "",
    domain: "",
    name: "",
    password: "",
    quota: 1073741824,
    active: true,
  });

  const { data: servers, isLoading: serversLoading } = useQuery({
    queryKey: ['mailcow-servers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mailcow_servers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as MailServer[];
    },
  });

  const { data: allMailboxes, isLoading: mailboxesLoading, refetch: refetchMailboxes } = useQuery({
    queryKey: ['mailcow-all-mailboxes'],
    queryFn: async () => {
      if (!servers || servers.length === 0) return [];
      
      const results = await Promise.all(
        servers.map(async (server) => {
          try {
            const { data, error } = await supabase.functions.invoke('mailcow-mailboxes', {
              body: { serverId: server.id },
            });
            if (error) throw error;
            return (data?.mailboxes || []).map((mailbox: any) => ({
              ...mailbox,
              serverId: server.id,
              serverName: server.name,
            }));
          } catch (error) {
            console.error(`Error fetching mailboxes for ${server.name}:`, error);
            return [];
          }
        })
      );
      
      return results.flat();
    },
    enabled: !!servers && servers.length > 0,
  });

  const { data: allDomains, isLoading: domainsLoading, refetch: refetchDomains } = useQuery({
    queryKey: ['mailcow-all-domains'],
    queryFn: async () => {
      if (!servers || servers.length === 0) return [];
      
      const results = await Promise.all(
        servers.map(async (server) => {
          try {
            const { data, error } = await supabase.functions.invoke('mailcow-domains', {
              body: { serverId: server.id },
            });
            if (error) throw error;
            return (data?.domains || []).map((domain: any) => ({
              ...domain,
              serverId: server.id,
              serverName: server.name,
            }));
          } catch (error) {
            console.error(`Error fetching domains for ${server.name}:`, error);
            return [];
          }
        })
      );
      
      return results.flat();
    },
    enabled: !!servers && servers.length > 0,
  });

  const manageDomainMutation = useMutation({
    mutationFn: async ({ action, domain, serverId }: { action: string; domain: any; serverId: string }) => {
      const { data, error } = await supabase.functions.invoke('mailcow-manage-domain', {
        body: { serverId, action, domain },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchDomains();
      setDomainDialogOpen(false);
      setEditingDomain(null);
      resetDomainForm();
      toast({ title: "Erfolg", description: "Domain wurde erfolgreich gespeichert" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const manageMailboxMutation = useMutation({
    mutationFn: async ({ action, mailbox, serverId }: { action: string; mailbox: any; serverId: string }) => {
      const { data, error } = await supabase.functions.invoke('mailcow-manage-mailbox', {
        body: { serverId, action, mailbox },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchMailboxes();
      setMailboxDialogOpen(false);
      setEditingMailbox(null);
      resetMailboxForm();
      toast({ title: "Erfolg", description: "Postfach wurde erfolgreich gespeichert" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (domain: Domain) => {
      const { data, error } = await supabase.functions.invoke('mailcow-manage-domain', {
        body: { serverId: domain.serverId, action: 'delete', domain: { domain_name: domain.domain_name } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchDomains();
      toast({ title: "Erfolg", description: "Domain wurde gelöscht" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const deleteMailboxMutation = useMutation({
    mutationFn: async (mailbox: Mailbox) => {
      const { data, error } = await supabase.functions.invoke('mailcow-manage-mailbox', {
        body: { serverId: mailbox.serverId, action: 'delete', mailbox: { username: mailbox.username } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchMailboxes();
      toast({ title: "Erfolg", description: "Postfach wurde gelöscht" });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const resetDomainForm = () => {
    setDomainForm({
      domain_name: "",
      description: "",
      max_aliases: 400,
      max_mailboxes: 10,
      default_quota: 1073741824,
      max_quota: 10737418240,
      quota: 10737418240,
      active: true,
    });
  };

  const resetMailboxForm = () => {
    setMailboxForm({
      local_part: "",
      domain: "",
      name: "",
      password: "",
      quota: 1073741824,
      active: true,
    });
  };

  const handleEditDomain = (domain: Domain) => {
    setEditingDomain(domain);
    setDomainForm({
      domain_name: domain.domain_name,
      description: domain.description,
      max_aliases: domain.max_num_aliases_for_domain,
      max_mailboxes: domain.max_num_mboxes_for_domain,
      default_quota: 1073741824,
      max_quota: 10737418240,
      quota: domain.max_quota_for_domain,
      active: domain.active === 1,
    });
    setDomainDialogOpen(true);
  };

  const handleEditMailbox = (mailbox: Mailbox) => {
    setEditingMailbox(mailbox);
    setMailboxForm({
      local_part: mailbox.local_part,
      domain: mailbox.domain,
      name: mailbox.name,
      password: "",
      quota: mailbox.quota,
      active: mailbox.active === 1,
    });
    setMailboxDialogOpen(true);
  };

  const handleSaveDomain = () => {
    if (!selectedServerForAction) {
      toast({ title: "Fehler", description: "Bitte wählen Sie einen Server", variant: "destructive" });
      return;
    }
    manageDomainMutation.mutate({
      action: editingDomain ? 'update' : 'create',
      domain: domainForm,
      serverId: selectedServerForAction,
    });
  };

  const handleSaveMailbox = () => {
    if (!selectedServerForAction) {
      toast({ title: "Fehler", description: "Bitte wählen Sie einen Server", variant: "destructive" });
      return;
    }
    const mailbox = {
      ...mailboxForm,
      username: editingMailbox ? editingMailbox.username : undefined,
    };
    manageMailboxMutation.mutate({
      action: editingMailbox ? 'update' : 'create',
      mailbox,
      serverId: selectedServerForAction,
    });
  };

  const handleRefresh = () => {
    refetchMailboxes();
    refetchDomains();
    toast({ title: "Aktualisiert", description: "Daten wurden neu geladen" });
  };

  const openWebmail = (mailbox: Mailbox) => {
    const server = servers?.find(s => s.id === mailbox.serverId);
    if (server?.host) {
      window.open(`${server.host}/SOGo/so/${mailbox.username}`, '_blank');
    }
  };

  const getServerColor = (serverId: string) => {
    const index = servers?.findIndex(s => s.id === serverId) || 0;
    return SERVER_COLORS[index % SERVER_COLORS.length];
  };

  const uniqueDomains = useMemo(() => {
    const domains = new Set<string>();
    allMailboxes?.forEach(m => domains.add(m.domain));
    return Array.from(domains).sort();
  }, [allMailboxes]);

  const filteredMailboxes = useMemo(() => {
    if (!allMailboxes) return [];
    
    return allMailboxes.filter(mailbox => {
      const matchesServer = serverFilter === "all" || mailbox.serverId === serverFilter;
      const matchesDomain = domainFilter === "all" || mailbox.domain === domainFilter;
      const matchesSearch = searchQuery === "" || 
        mailbox.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mailbox.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesServer && matchesDomain && matchesSearch;
    });
  }, [allMailboxes, serverFilter, domainFilter, searchQuery]);

  const filteredDomains = useMemo(() => {
    if (!allDomains) return [];
    
    return allDomains.filter(domain => {
      const matchesServer = serverFilter === "all" || domain.serverId === serverFilter;
      return matchesServer;
    });
  }, [allDomains, serverFilter]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <main className="flex-1 p-12">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Mail</h1>
            <p className="mt-2 text-muted-foreground">Mailcow Mailserver Verwaltung</p>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>

        {serversLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : servers && servers.length > 0 ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <div className="flex-1">
                  <Label>Mailserver</Label>
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
                  <Label>Domain</Label>
                  <Select value={domainFilter} onValueChange={setDomainFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Domains</SelectItem>
                      {uniqueDomains.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {domain}
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
                      placeholder="E-Mail oder Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="domains" className="space-y-4">
              <TabsList>
                <TabsTrigger value="domains">
                  <Server className="mr-2 h-4 w-4" />
                  Domains
                </TabsTrigger>
                <TabsTrigger value="mailboxes">
                  <MailIcon className="mr-2 h-4 w-4" />
                  Postfächer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="domains">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Domains</CardTitle>
                      <CardDescription>
                        {filteredDomains.length} Domains gefunden
                      </CardDescription>
                    </div>
                    <Button onClick={() => { 
                      resetDomainForm(); 
                      setEditingDomain(null); 
                      setSelectedServerForAction(servers[0]?.id || "");
                      setDomainDialogOpen(true); 
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Neue Domain
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {domainsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : filteredDomains.length > 0 ? (
                      <ScrollArea className="w-full">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[150px]">Mailserver</TableHead>
                              <TableHead className="min-w-[200px]">Domain</TableHead>
                              <TableHead className="min-w-[200px]">Beschreibung</TableHead>
                              <TableHead className="min-w-[100px]">Aliase</TableHead>
                              <TableHead className="min-w-[100px]">Postfächer</TableHead>
                              <TableHead className="min-w-[80px]">Status</TableHead>
                              <TableHead className="min-w-[150px] text-right">Aktionen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDomains.map((domain: Domain, index: number) => (
                              <TableRow key={`${domain.domain_name}-${index}`}>
                                <TableCell>
                                  <Badge className={`${getServerColor(domain.serverId)} text-white`}>
                                    {domain.serverName}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{domain.domain_name}</TableCell>
                                <TableCell>{domain.description}</TableCell>
                                <TableCell>{domain.aliases_in_domain}</TableCell>
                                <TableCell>{domain.mboxes_in_domain}</TableCell>
                                <TableCell>
                                  <Badge variant={domain.active ? "default" : "secondary"}>
                                    {domain.active ? "Aktiv" : "Inaktiv"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedServerForAction(domain.serverId);
                                        handleEditDomain(domain);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteDomainMutation.mutate(domain)}
                                      disabled={deleteDomainMutation.isPending}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Keine Domains gefunden
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="mailboxes">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Postfächer</CardTitle>
                      <CardDescription>
                        {filteredMailboxes.length} Postfächer gefunden
                      </CardDescription>
                    </div>
                    <Button onClick={() => { 
                      resetMailboxForm(); 
                      setEditingMailbox(null); 
                      setSelectedServerForAction(servers[0]?.id || "");
                      setMailboxDialogOpen(true); 
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Neues Postfach
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {mailboxesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : filteredMailboxes.length > 0 ? (
                      <ScrollArea className="w-full">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[150px]">Mailserver</TableHead>
                              <TableHead className="min-w-[200px]">E-Mail</TableHead>
                              <TableHead className="min-w-[150px]">Name</TableHead>
                              <TableHead className="min-w-[100px]">Quota</TableHead>
                              <TableHead className="min-w-[100px]">Verwendet</TableHead>
                              <TableHead className="min-w-[100px]">Nachrichten</TableHead>
                              <TableHead className="min-w-[80px]">Status</TableHead>
                              <TableHead className="min-w-[200px] text-right">Aktionen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredMailboxes.map((mailbox: Mailbox, index: number) => (
                              <TableRow key={`${mailbox.username}-${index}`}>
                                <TableCell>
                                  <Badge className={`${getServerColor(mailbox.serverId)} text-white`}>
                                    {mailbox.serverName}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{mailbox.username}</TableCell>
                                <TableCell>{mailbox.name}</TableCell>
                                <TableCell>{formatBytes(mailbox.quota)}</TableCell>
                                <TableCell>{formatBytes(mailbox.quota_used)}</TableCell>
                                <TableCell>{mailbox.messages}</TableCell>
                                <TableCell>
                                  <Badge variant={mailbox.active ? "default" : "secondary"}>
                                    {mailbox.active ? "Aktiv" : "Inaktiv"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openWebmail(mailbox)}
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      Webmail
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedServerForAction(mailbox.serverId);
                                        handleEditMailbox(mailbox);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteMailboxMutation.mutate(mailbox)}
                                      disabled={deleteMailboxMutation.isPending}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                      </ScrollArea>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Keine Postfächer gefunden
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Keine Mailserver konfiguriert</CardTitle>
              <CardDescription>
                Fügen Sie einen Mailserver in den Einstellungen hinzu
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* Domain Dialog */}
      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDomain ? "Domain bearbeiten" : "Neue Domain"}</DialogTitle>
            <DialogDescription>
              {editingDomain ? "Bearbeiten Sie die Domain-Einstellungen" : "Erstellen Sie eine neue Mail-Domain"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingDomain && (
              <div className="grid gap-2">
                <Label htmlFor="server_select">Mailserver</Label>
                <Select value={selectedServerForAction} onValueChange={setSelectedServerForAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mailserver wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servers?.map((server) => (
                      <SelectItem key={server.id} value={server.id}>
                        {server.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="domain_name">Domain Name</Label>
              <Input
                id="domain_name"
                value={domainForm.domain_name}
                onChange={(e) => setDomainForm({ ...domainForm, domain_name: e.target.value })}
                disabled={!!editingDomain}
                placeholder="beispiel.de"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                value={domainForm.description}
                onChange={(e) => setDomainForm({ ...domainForm, description: e.target.value })}
                placeholder="Beschreibung der Domain"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="max_aliases">Max. Aliase</Label>
                <Input
                  id="max_aliases"
                  type="number"
                  value={domainForm.max_aliases}
                  onChange={(e) => setDomainForm({ ...domainForm, max_aliases: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_mailboxes">Max. Postfächer</Label>
                <Input
                  id="max_mailboxes"
                  type="number"
                  value={domainForm.max_mailboxes}
                  onChange={(e) => setDomainForm({ ...domainForm, max_mailboxes: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={domainForm.active}
                onCheckedChange={(checked) => setDomainForm({ ...domainForm, active: checked })}
              />
              <Label htmlFor="active">Domain aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveDomain} disabled={manageDomainMutation.isPending}>
              {manageDomainMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mailbox Dialog */}
      <Dialog open={mailboxDialogOpen} onOpenChange={setMailboxDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMailbox ? "Postfach bearbeiten" : "Neues Postfach"}</DialogTitle>
            <DialogDescription>
              {editingMailbox ? "Bearbeiten Sie die Postfach-Einstellungen" : "Erstellen Sie ein neues Postfach"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingMailbox && (
              <div className="grid gap-2">
                <Label htmlFor="server_select_mailbox">Mailserver</Label>
                <Select value={selectedServerForAction} onValueChange={setSelectedServerForAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mailserver wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servers?.map((server) => (
                      <SelectItem key={server.id} value={server.id}>
                        {server.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="local_part">Lokaler Teil</Label>
                <Input
                  id="local_part"
                  value={mailboxForm.local_part}
                  onChange={(e) => setMailboxForm({ ...mailboxForm, local_part: e.target.value })}
                  disabled={!!editingMailbox}
                  placeholder="benutzer"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="domain">Domain</Label>
                <Select
                  value={mailboxForm.domain}
                  onValueChange={(value) => setMailboxForm({ ...mailboxForm, domain: value })}
                  disabled={!!editingMailbox}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Domain wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allDomains?.filter(d => d.serverId === selectedServerForAction).map((domain: Domain) => (
                      <SelectItem key={domain.domain_name} value={domain.domain_name}>
                        {domain.domain_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={mailboxForm.name}
                onChange={(e) => setMailboxForm({ ...mailboxForm, name: e.target.value })}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passwort {editingMailbox && "(leer lassen zum Behalten)"}</Label>
              <Input
                id="password"
                type="password"
                value={mailboxForm.password}
                onChange={(e) => setMailboxForm({ ...mailboxForm, password: e.target.value })}
                placeholder={editingMailbox ? "Neues Passwort" : "Passwort"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quota">Quota (MB)</Label>
              <Input
                id="quota"
                type="number"
                value={mailboxForm.quota / 1048576}
                onChange={(e) => setMailboxForm({ ...mailboxForm, quota: parseInt(e.target.value) * 1048576 })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="mailbox_active"
                checked={mailboxForm.active}
                onCheckedChange={(checked) => setMailboxForm({ ...mailboxForm, active: checked })}
              />
              <Label htmlFor="mailbox_active">Postfach aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMailboxDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveMailbox} disabled={manageMailboxMutation.isPending}>
              {manageMailboxMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Mail;