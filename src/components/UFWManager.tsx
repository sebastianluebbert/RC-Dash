import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ufwService } from '@/services/ufw.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldOff, Plus, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UFWManagerProps {
  serverId: string;
  serverName: string;
}

export function UFWManager({ serverId, serverName }: UFWManagerProps) {
  const queryClient = useQueryClient();
  const [newPort, setNewPort] = useState('');
  const [newProtocol, setNewProtocol] = useState<'tcp' | 'udp' | 'any'>('tcp');
  const [newFrom, setNewFrom] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['ufw-status', serverId],
    queryFn: () => ufwService.getStatus(serverId),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['ufw-rules', serverId],
    queryFn: () => ufwService.listRules(serverId),
  });

  const enableMutation = useMutation({
    mutationFn: () => ufwService.enableFirewall(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ufw-status', serverId] });
      toast.success('Firewall enabled');
    },
    onError: () => {
      toast.error('Failed to enable firewall');
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => ufwService.disableFirewall(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ufw-status', serverId] });
      toast.success('Firewall disabled');
    },
    onError: () => {
      toast.error('Failed to disable firewall');
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: () => ufwService.addRule(serverId, newPort, newProtocol, newFrom || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ufw-rules', serverId] });
      setNewPort('');
      setNewFrom('');
      toast.success('Rule added successfully');
    },
    onError: () => {
      toast.error('Failed to add rule');
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleNumber: string) => ufwService.deleteRule(serverId, ruleNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ufw-rules', serverId] });
      toast.success('Rule deleted');
    },
    onError: () => {
      toast.error('Failed to delete rule');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => ufwService.resetFirewall(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ufw-status', serverId] });
      queryClient.invalidateQueries({ queryKey: ['ufw-rules', serverId] });
      toast.success('Firewall reset');
    },
    onError: () => {
      toast.error('Failed to reset firewall');
    },
  });

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPort) {
      toast.error('Port is required');
      return;
    }
    addRuleMutation.mutate();
  };

  if (isLoading) {
    return <div>Loading firewall status...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              UFW Firewall - {serverName}
            </span>
            <Badge variant={status?.enabled ? 'default' : 'secondary'}>
              {status?.enabled ? 'Active' : 'Inactive'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Manage UFW firewall rules for this server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => enableMutation.mutate()}
              disabled={enableMutation.isPending || status?.enabled}
              variant="default"
            >
              <Shield className="h-4 w-4 mr-2" />
              Enable Firewall
            </Button>
            <Button
              onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending || !status?.enabled}
              variant="outline"
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              Disable Firewall
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={resetMutation.isPending}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Firewall?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all firewall rules and disable UFW. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resetMutation.mutate()}>
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {status && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Default incoming:</span> {status.defaultIncoming}
              </div>
              <div>
                <span className="font-medium">Default outgoing:</span> {status.defaultOutgoing}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add New Rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddRule} className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  placeholder="80"
                  value={newPort}
                  onChange={(e) => setNewPort(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="protocol">Protocol</Label>
                <Select value={newProtocol} onValueChange={(v: any) => setNewProtocol(v)}>
                  <SelectTrigger id="protocol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="any">Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="from">From IP (optional)</Label>
                <Input
                  id="from"
                  placeholder="192.168.1.0/24"
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={addRuleMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firewall Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Port/Protocol</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No firewall rules configured
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.number}>
                    <TableCell>{rule.number}</TableCell>
                    <TableCell>
                      <Badge variant={rule.action === 'ALLOW' ? 'default' : 'destructive'}>
                        {rule.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{rule.from}</TableCell>
                    <TableCell>{rule.to}</TableCell>
                    <TableCell>
                      {rule.port && rule.protocol ? `${rule.port}/${rule.protocol}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rule.number && deleteRuleMutation.mutate(rule.number)}
                        disabled={deleteRuleMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
