import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

interface Props {
  title: string;
}

export function TopBar({ title }: Props) {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-border px-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Auto-refresh</span>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <button
          onClick={toggle}
          className="flex items-center justify-center rounded-lg p-2 text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
