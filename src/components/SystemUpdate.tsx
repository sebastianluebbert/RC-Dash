import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { systemService } from "@/services/system.service";
import { RefreshCw, Download, CheckCircle2, AlertCircle, GitBranch, FileText } from "lucide-react";
import { ChangelogViewer } from "./ChangelogViewer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const SystemUpdate = () => {
  const { toast } = useToast();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const { data: versionInfo, isLoading: versionLoading } = useQuery({
    queryKey: ['system-version'],
    queryFn: systemService.getVersion,
  });

  const { data: updateCheck, isLoading: updateCheckLoading, refetch: checkForUpdates } = useQuery({
    queryKey: ['system-update-check'],
    queryFn: systemService.checkForUpdates,
    refetchInterval: false,
    enabled: false, // Only fetch when manually triggered
  });

  const updateMutation = useMutation({
    mutationFn: systemService.performUpdate,
    onSuccess: (data) => {
      toast({
        title: "Update gestartet",
        description: data.message,
      });
      setShowUpdateDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Update fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    },
  });

  const handleCheckForUpdates = () => {
    checkForUpdates();
    toast({
      title: "Prüfe auf Updates...",
      description: "Verbinde mit Repository",
    });
  };

  const handleUpdate = () => {
    updateMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            System-Updates
          </CardTitle>
          <CardDescription>
            Aktuelle Version und verfügbare Updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Version */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div>
              <p className="text-sm text-muted-foreground">Aktuelle Version</p>
              <p className="text-lg font-semibold">
                {versionLoading ? "Lädt..." : `v${versionInfo?.version}`}
              </p>
            </div>
            <Badge variant="outline">RexCloud</Badge>
          </div>

          {/* Update Status */}
          {updateCheck && (
            <Alert variant={updateCheck.hasUpdate ? "default" : "default"}>
              <div className="flex items-start gap-2">
                {updateCheck.hasUpdate ? (
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertTitle>
                    {updateCheck.hasUpdate ? "Update verfügbar!" : "System ist aktuell"}
                  </AlertTitle>
                  <AlertDescription>
                    {updateCheck.hasUpdate ? (
                      <div className="mt-2 space-y-2">
                        <p>
                          {updateCheck.updateInfo?.commits} neue Commits verfügbar
                        </p>
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">Änderungen:</p>
                          {updateCheck.updateInfo?.changes.map((change, idx) => (
                            <p key={idx} className="text-muted-foreground">
                              • {change}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1">
                        Commit: {updateCheck.currentCommit}
                      </p>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleCheckForUpdates}
              disabled={updateCheckLoading}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${updateCheckLoading ? 'animate-spin' : ''}`} />
              Nach Updates suchen
            </Button>
            
            {updateCheck?.hasUpdate && (
              <Button
                onClick={() => setShowUpdateDialog(true)}
                disabled={updateMutation.isPending}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Jetzt aktualisieren
              </Button>
            )}
          </div>

          {/* Changelog Button */}
          <Button
            onClick={() => setShowChangelog(!showChangelog)}
            variant="outline"
            className="w-full"
          >
            <FileText className="mr-2 h-4 w-4" />
            {showChangelog ? "Changelog ausblenden" : "Changelog anzeigen"}
          </Button>

          {/* Info Text */}
          <p className="text-xs text-muted-foreground">
            Updates werden automatisch aus dem Git-Repository abgerufen und installiert.
            Die Anwendung wird während des Updates neu gestartet.
          </p>
        </CardContent>

        {/* Update Confirmation Dialog */}
        <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>System aktualisieren?</AlertDialogTitle>
              <AlertDialogDescription>
                Das System wird auf die neueste Version aktualisiert. Während des Updates wird
                die Anwendung neu gestartet. Dieser Vorgang dauert ca. 2-3 Minuten.
                <br /><br />
                <strong>Neue Commits: {updateCheck?.updateInfo?.commits}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Wird aktualisiert..." : "Aktualisieren"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      {/* Changelog Viewer */}
      {showChangelog && (
        <ChangelogViewer 
          from={updateCheck?.currentCommit}
          to={updateCheck?.latestCommit}
        />
      )}
    </div>
  );
};
