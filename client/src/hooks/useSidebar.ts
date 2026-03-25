import { createContext, useContext, useState, useCallback } from "react";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

export const SidebarContext = createContext<SidebarState>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebarState(): SidebarState {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  }, []);

  return { collapsed, toggle };
}

export function useSidebar(): SidebarState {
  return useContext(SidebarContext);
}
