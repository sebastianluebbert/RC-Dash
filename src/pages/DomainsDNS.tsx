import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DNSRecord {
  id: string;
  zone_id: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  created: string;
  modified: string;
  rrset_id: string; // RRSet ID for updates/deletes
}

const DomainsDNS = () => {
  const [searchParams] = useSearchParams();
  const zoneId = searchParams.get("zone");
  const zoneName = searchParams.get("name");
  const provider = searchParams.get("provider") || "hetzner";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [formData, setFormData] = useState({
    type: "A",
    name: "",
    value: "",
    ttl: 3600,
  });

  const { data: recordsData, isLoading } = useQuery({
    queryKey: [`${provider}-dns-records`, zoneId],
    queryFn: async () => {
      const functionName = provider === 'autodns' ? 'autodns-dns-records' : 'hetzner-dns-records';
      const bodyKey = provider === 'autodns' ? 'zoneName' : 'zoneId';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { [bodyKey]: zoneId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!zoneId,
  });

  const manageMutation = useMutation({
    mutationFn: async (params: { action: string; rrsetId?: string; record?: any }) => {
      const functionName = provider === 'autodns' ? 'autodns-dns-manage' : 'hetzner-dns-manage';
      const bodyKey = provider === 'autodns' ? 'zoneName' : 'zoneId';
      const idKey = provider === 'autodns' ? undefined : 'rrsetId'; // AutoDNS doesn't use rrsetId
      
      const body: any = {
        action: params.action,
        [bodyKey]: zoneId,
        record: params.record,
      };
      
      // Only add rrsetId for Hetzner
      if (provider === 'hetzner' && params.rrsetId) {
        body.rrsetId = params.rrsetId;
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${provider}-dns-records`, zoneId] });
      setIsDialogOpen(false);
      setEditingRecord(null);
      resetForm();
      toast({
        title: "Erfolg",
        description: "DNS-Eintrag wurde erfolgreich gespeichert",
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

  const deleteMutation = useMutation({
    mutationFn: async (record: DNSRecord) => {
      const functionName = provider === 'autodns' ? 'autodns-dns-manage' : 'hetzner-dns-manage';
      const bodyKey = provider === 'autodns' ? 'zoneName' : 'zoneId';
      
      const body: any = {
        action: 'delete',
        [bodyKey]: zoneId,
        record: {
          name: record.name,
          type: record.type,
        },
      };
      
      // Only add rrsetId for Hetzner
      if (provider === 'hetzner') {
        body.rrsetId = record.rrset_id;
      }
      
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${provider}-dns-records`, zoneId] });
      toast({
        title: "Erfolg",
        description: "DNS-Eintrag wurde gelöscht",
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

  const resetForm = () => {
    setFormData({
      type: "A",
      name: "",
      value: "",
      ttl: 3600,
    });
  };

  const handleEdit = (record: DNSRecord) => {
    setEditingRecord(record);
    setFormData({
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingRecord) {
      manageMutation.mutate({
        action: "update",
        rrsetId: editingRecord.rrset_id,
        record: formData,
      });
    } else {
      manageMutation.mutate({
        action: "create",
        record: formData,
      });
    }
  };

  if (!zoneId) {
    return (
      <main className="flex-1 p-12">
        <Card>
          <CardHeader>
            <CardTitle>Fehler</CardTitle>
            <CardDescription>Keine Zone ausgewählt</CardDescription>
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
            <h1 className="text-4xl font-bold text-foreground">DNS-Verwaltung</h1>
            <p className="mt-2 text-muted-foreground">{zoneName}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingRecord(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                Neuer Eintrag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingRecord ? "Eintrag bearbeiten" : "Neuer DNS-Eintrag"}
                </DialogTitle>
                <DialogDescription>
                  Erstellen oder bearbeiten Sie einen DNS-Eintrag
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="type">Typ</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="AAAA">AAAA</SelectItem>
                      <SelectItem value="CNAME">CNAME</SelectItem>
                      <SelectItem value="MX">MX</SelectItem>
                      <SelectItem value="TXT">TXT</SelectItem>
                      <SelectItem value="NS">NS</SelectItem>
                      <SelectItem value="SRV">SRV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="@, www, mail, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="value">Wert</Label>
                  <Input
                    id="value"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="IP-Adresse oder Zielwert"
                  />
                </div>
                <div>
                  <Label htmlFor="ttl">TTL (Sekunden)</Label>
                  <Input
                    id="ttl"
                    type="number"
                    value={formData.ttl}
                    onChange={(e) => setFormData({ ...formData, ttl: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSubmit}
                  disabled={manageMutation.isPending}
                >
                  {manageMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {recordsData?.records && (
          <Card>
            <CardHeader>
              <CardTitle>DNS-Einträge</CardTitle>
              <CardDescription>
                {recordsData.records.length} Einträge gefunden
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[80px]">Typ</TableHead>
                      <TableHead className="min-w-[150px]">Name</TableHead>
                      <TableHead className="min-w-[300px]">Wert</TableHead>
                      <TableHead className="min-w-[80px]">TTL</TableHead>
                      <TableHead className="text-right min-w-[120px]">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TooltipProvider>
                      {recordsData.records.map((record: DNSRecord) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.type}</TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="max-w-[200px] truncate">
                                  {record.name || "@"}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[500px] break-all">
                                <p>{record.name || "@"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="font-mono text-sm max-w-[400px] truncate">
                                  {record.value}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[600px] break-all">
                                <p className="font-mono text-sm">{record.value}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{record.ttl}s</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(record)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(record)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TooltipProvider>
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default DomainsDNS;
