import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { systemService, ChangelogCommit } from "@/services/system.service";
import { 
  GitCommit, 
  Bug, 
  Sparkles, 
  FileText, 
  Zap, 
  Shield, 
  Settings,
  Calendar,
  User
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const categoryConfig = {
  features: {
    label: "Neue Features",
    icon: Sparkles,
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  fixes: {
    label: "Fehlerbehebungen",
    icon: Bug,
    color: "text-red-500",
    bgColor: "bg-red-500/10"
  },
  improvements: {
    label: "Verbesserungen",
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  security: {
    label: "Sicherheit",
    icon: Shield,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10"
  },
  documentation: {
    label: "Dokumentation",
    icon: FileText,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  other: {
    label: "Sonstiges",
    icon: Settings,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10"
  }
};

interface ChangelogViewerProps {
  from?: string;
  to?: string;
}

export const ChangelogViewer = ({ from, to }: ChangelogViewerProps) => {
  const { data: changelog, isLoading } = useQuery({
    queryKey: ['changelog', from, to],
    queryFn: () => systemService.getChangelog(from, to),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Lade Changelog...</div>
        </CardContent>
      </Card>
    );
  }

  if (!changelog || changelog.total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Keine Änderungen gefunden</div>
        </CardContent>
      </Card>
    );
  }

  const renderCommit = (commit: ChangelogCommit) => {
    const config = categoryConfig[commit.category as keyof typeof categoryConfig] || categoryConfig.other;
    const Icon = config.icon;

    return (
      <div key={commit.commit} className="flex gap-3 py-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm">{commit.message}</p>
            <Badge variant="outline" className="flex-shrink-0 text-xs">
              {commit.short}
            </Badge>
          </div>
          {commit.body && commit.body.trim() && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
              {commit.body.trim()}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {commit.author}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(commit.date), { addSuffix: true, locale: de })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              Changelog
            </CardTitle>
            <CardDescription>
              {changelog.total} Änderungen in der Historie
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {Object.entries(categoryConfig).map(([category, config]) => {
              const commits = changelog.grouped[category];
              if (!commits || commits.length === 0) return null;

              const Icon = config.icon;

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-6 h-6 rounded ${config.bgColor} flex items-center justify-center`}>
                      <Icon className={`h-3 w-3 ${config.color}`} />
                    </div>
                    <h3 className="font-semibold text-sm">
                      {config.label}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {commits.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {commits.map(renderCommit)}
                  </div>
                  <Separator className="mt-4" />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
