import {
  LayoutDashboard,
  Search,
  Activity,
  Server,
  AppWindow,
  Shield,
  Settings,
  BookOpen,
  MonitorCog,
  Package,
  FileText,
  ClipboardCheck,
  CalendarClock,
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
  { label: "System Info", icon: MonitorCog, path: "/system-info" },
  { label: "Knowledge", icon: Package, path: "/knowledge" },
  {
    label: "Audits",
    icon: ClipboardCheck,
    children: [
      { label: "Scheduled Searches", icon: CalendarClock, path: "/audits/scheduled-searches" },
    ],
  },
  { label: "Security", icon: Shield, path: "/security" },
  { label: "Conf Files", icon: FileText, path: "/conf-reference" },
  { label: "API Docs", icon: BookOpen, path: "/docs" },
  { label: "Settings", icon: Settings, path: "/settings" },
];
