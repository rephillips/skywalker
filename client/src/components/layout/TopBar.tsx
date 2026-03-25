import { Clock, Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useGlobalTime, TIME_PRESETS } from "../../hooks/useGlobalTime";

interface Props {
  title: string;
}

export function TopBar({ title }: Props) {
  const { theme, toggle } = useTheme();
  const { label, setTime } = useGlobalTime();

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-border px-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        {/* Global time picker */}
        <div className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5">
          <Clock size={13} className="text-gray-500" />
          <select
            value={label}
            onChange={(e) => {
              const preset = TIME_PRESETS.find((p) => p.label === e.target.value);
              if (preset) setTime(preset.earliest, preset.latest, preset.label);
            }}
            className="bg-transparent text-xs text-gray-300 outline-none cursor-pointer"
          >
            {TIME_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
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
