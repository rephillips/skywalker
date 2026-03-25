import { NavLink } from "react-router-dom";
import clsx from "clsx";
import type { NavItem } from "../../config/navigation";
import { useSidebar } from "../../hooks/useSidebar";

interface Props {
  item: NavItem;
  depth?: number;
}

export function SidebarItem({ item, depth = 0 }: Props) {
  const { collapsed } = useSidebar();
  const Icon = item.icon;

  if (!item.path) return null;

  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx(
          "flex items-center rounded-md text-[13px] font-medium transition-colors",
          collapsed ? "justify-center py-1.5 px-0" : "gap-2.5 px-2.5 py-1.5",
          depth > 0 && !collapsed && "ml-6",
          isActive
            ? "bg-brand-500/10 text-brand-400"
            : "text-gray-500 hover:text-gray-200 hover:bg-surface-hover"
        )
      }
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}
