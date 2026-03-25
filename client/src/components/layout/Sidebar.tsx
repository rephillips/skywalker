import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import clsx from "clsx";
import { navigation } from "../../config/navigation";
import { SidebarSection } from "./SidebarSection";
import { useTheme } from "../../hooks/useTheme";

export function Sidebar() {
  const [hovered, setHovered] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <>
      {/* Hover trigger strip — always visible on left edge */}
      <div
        className="fixed top-0 left-0 z-40 h-screen w-3"
        onMouseEnter={() => setHovered(true)}
      />

      {/* Overlay when sidebar is open */}
      {hovered && (
        <div
          className="fixed inset-0 z-30"
          onMouseEnter={() => setHovered(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={clsx(
          "fixed top-0 left-0 z-40 flex h-screen w-60 flex-col border-r border-surface-border bg-surface shadow-2xl shadow-black/50 transition-transform duration-200 ease-out",
          hovered ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-surface-border px-4">
          <svg width="20" height="28" viewBox="0 0 20 40" fill="none" className="shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(0,255,70,0.6)) drop-shadow(0 0 10px rgba(0,255,70,0.25))" }}>
            {/* Blade glow */}
            <rect x="7" y="0" width="6" height="24" rx="3" fill="rgba(0,255,70,0.25)" />
            {/* Blade core */}
            <rect x="8.5" y="1" width="3" height="22" rx="1.5" fill="url(#blade)" />
            {/* Emitter */}
            <rect x="6" y="23" width="8" height="2" rx="0.5" fill="#8a8a8a" />
            {/* Grip */}
            <rect x="7" y="25" width="6" height="10" rx="1" fill="url(#grip)" />
            {/* Grip lines */}
            <rect x="6.5" y="28" width="7" height="4" rx="0.5" fill="url(#lines)" />
            {/* Pommel */}
            <rect x="6" y="35" width="8" height="1.5" rx="0.5" fill="#7a7a7a" />
            <rect x="7.5" y="36.5" width="5" height="2.5" rx="1" fill="#3a3a3a" />
            <defs>
              <linearGradient id="blade" x1="10" y1="1" x2="10" y2="23" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="10%" stopColor="#b0ffb0" />
                <stop offset="50%" stopColor="#00ff46" />
                <stop offset="100%" stopColor="#009922" />
              </linearGradient>
              <linearGradient id="grip" x1="7" y1="25" x2="13" y2="25" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3a3a3a" />
                <stop offset="50%" stopColor="#7a7a7a" />
                <stop offset="100%" stopColor="#3a3a3a" />
              </linearGradient>
              <linearGradient id="lines" x1="10" y1="28" x2="10" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4a4a4a" />
                <stop offset="50%" stopColor="#2a2a2a" />
                <stop offset="100%" stopColor="#4a4a4a" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-sm font-semibold text-white tracking-tight">
            SkyWalker
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {navigation.map((item) => (
            <SidebarSection key={item.label} item={item} />
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="border-t border-surface-border p-2">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="text-xs">
              {theme === "dark" ? "Sunset Surfing" : "Dark Mode"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
