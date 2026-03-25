import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { NavItem } from "../../config/navigation";
import { SidebarItem } from "./SidebarItem";
import { useSidebar } from "../../hooks/useSidebar";

interface Props {
  item: NavItem;
}

export function SidebarSection({ item }: Props) {
  const [open, setOpen] = useState(true);
  const { collapsed } = useSidebar();
  const Icon = item.icon;

  if (!item.children) {
    return <SidebarItem item={item} />;
  }

  // Collapsed: just show icons for each child
  if (collapsed) {
    return (
      <div className="flex flex-col gap-0.5">
        {item.children.map((child) => (
          <SidebarItem key={child.label} item={child} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-200 hover:bg-surface-hover transition-colors"
      >
        <Icon size={16} className="shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        <ChevronDown
          size={12}
          className={clsx(
            "shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {item.children.map((child) => (
            <SidebarItem key={child.label} item={child} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
}
