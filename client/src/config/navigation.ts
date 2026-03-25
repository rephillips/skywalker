import {
  LayoutDashboard,
  Search,
  Activity,
  Server,
  AppWindow,
  Shield,
  Settings,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  path?: string;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Search", icon: Search, path: "/search" },
  {
    label: "Monitoring",
    icon: Activity,
    children: [
      { label: "Infrastructure", icon: Server, path: "/monitoring/infra" },
      { label: "Applications", icon: AppWindow, path: "/monitoring/apps" },
    ],
  },
  { label: "Security", icon: Shield, path: "/security" },
  { label: "API Docs", icon: BookOpen, path: "/docs" },
  { label: "Settings", icon: Settings, path: "/settings" },
];
