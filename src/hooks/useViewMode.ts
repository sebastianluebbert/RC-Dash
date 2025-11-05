import { useState, useEffect } from "react";
import { ViewMode } from "@/components/ViewToggle";

export function useViewMode(storageKey: string) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(storageKey);
    return (stored as ViewMode) || "grid";
  });

  useEffect(() => {
    localStorage.setItem(storageKey, viewMode);
  }, [viewMode, storageKey]);

  return [viewMode, setViewMode] as const;
}
