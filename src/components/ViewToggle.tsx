import { LayoutGrid, LayoutList, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "grid" | "compact" | "list";

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
      <Button
        variant={viewMode === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("grid")}
        className="h-8 w-8 p-0"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === "compact" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("compact")}
        className="h-8 w-8 p-0"
      >
        <Rows3 className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("list")}
        className="h-8 w-8 p-0"
      >
        <LayoutList className="h-4 w-4" />
      </Button>
    </div>
  );
}
