import { useState, useEffect } from "react";
import { Clock, Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useGlobalTime, TIME_PRESETS } from "../../hooks/useGlobalTime";

interface Props {
  title: string;
}

export function TopBar({ title }: Props) {
  const { theme, toggle } = useTheme();
  const { label, setTime } = useGlobalTime();
  const [connection, setConnection] = useState<{ connected: boolean; host: string }>({ connected: false, host: "" });

  useEffect(() => {
    fetch("/api/config", { headers: { "Cache-Control": "no-cache" } })
      .then((r) => r.json())
      .then((cfg) => {
        const hasAuth = cfg.hasToken || cfg.hasPassword;
        const host = cfg.baseUrl?.replace(/^https?:\/\//, "").replace(/:\d+$/, "") || "";
        if (hasAuth) {
          // Quick health check
          fetch("/api/health")
            .then((r) => r.json())
            .then((h) => setConnection({ connected: h.splunk === "reachable", host: h.serverName || host }))
            .catch(() => setConnection({ connected: false, host }));
        } else {
          setConnection({ connected: false, host: "" });
        }
      })
      .catch(() => setConnection({ connected: false, host: "" }));
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-border px-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: connection.connected ? "#10b981" : "#ef4444",
              boxShadow: connection.connected
                ? "0 0 6px #10b98180, 0 0 12px #10b98140"
                : "0 0 6px #ef444480, 0 0 12px #ef444440",
            }}
          />
          <span className="text-[10px] text-gray-400 font-mono">
            {connection.connected ? connection.host : "Not connected"}
          </span>
        </div>

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
