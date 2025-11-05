import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { systemService } from "@/services/system.service";
import { Tag, Calendar, GitCommit, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChangelogViewer } from "./ChangelogViewer";

export const VersionHistory = () => {
  const [selectedVersion, setSelectedVersion] = useState<{ from: string; to: string } | null>(null);

  const { data: tags, isLoading } = useQuery({
    queryKey: ['version-tags'],
    queryFn: systemService.getTags,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Lade Versionen...</div>
        </CardContent>
      </Card>
    );
  }

  if (!tags || tags.total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Keine Versions-Tags gefunden
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Versions-Historie
          </CardTitle>
          <CardDescription>
            {tags.total} veröffentlichte Versionen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {tags.tags.map((tag, index) => (
                <div
                  key={tag.tag}
                  className="flex items-start justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={index === 0 ? "default" : "outline"} className="text-sm">
                        {tag.tag}
                      </Badge>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Aktuell
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {tag.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {tag.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(tag.date), { addSuffix: true, locale: de })}
                        </span>
                      )}
                      {tag.commit && (
                        <span className="flex items-center gap-1">
                          <GitCommit className="h-3 w-3" />
                          {tag.commit}
                        </span>
                      )}
                    </div>
                  </div>
                  {index > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedVersion({ 
                        from: tags.tags[index].commit || '',
                        to: tags.tags[0].commit || ''
                      })}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Änderungen
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedVersion && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Änderungen zwischen Versionen</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedVersion(null)}
            >
              Schließen
            </Button>
          </div>
          <ChangelogViewer 
            from={selectedVersion.from}
            to={selectedVersion.to}
          />
        </div>
      )}
    </div>
  );
};
