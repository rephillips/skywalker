import { useState, useCallback } from "react";
import type { PanelConfig } from "../types/dashboard";

const STORAGE_KEY = "skywalker-custom-panels";

function load(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(panels: PanelConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
}

export function useCustomPanels() {
  const [panels, setPanels] = useState<PanelConfig[]>(load);

  const addPanel = useCallback((panel: PanelConfig) => {
    setPanels((prev) => {
      const next = [...prev, panel];
      save(next);
      return next;
    });
  }, []);

  const removePanel = useCallback((id: string) => {
    setPanels((prev) => {
      const next = prev.filter((p) => p.id !== id);
      save(next);
      return next;
    });
  }, []);

  const updatePanel = useCallback((id: string, updates: Partial<PanelConfig>) => {
    setPanels((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      save(next);
      return next;
    });
  }, []);

  return { panels, addPanel, removePanel, updatePanel };
}
