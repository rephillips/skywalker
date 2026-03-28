import { useState, useEffect, useCallback } from "react";
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

  const checkConnection = useCallback(() => {
    fetch("/api/config", { headers: { "Cache-Control": "no-cache" } })
      .then((r) => r.json())
      .then((cfg) => {
        const hasAuth = cfg.hasToken || cfg.hasPassword;
        const host = cfg.baseUrl?.replace(/^https?:\/\//, "").replace(/:\d+$/, "") || "";
        if (hasAuth) {
          fetch("/api/health", { headers: { "Cache-Control": "no-cache" } })
            .then((r) => r.json())
            .then((h) => setConnection({ connected: h.splunk === "reachable", host: h.serverName || host }))
            .catch(() => setConnection({ connected: false, host }));
        } else {
          setConnection({ connected: false, host: "" });
        }
      })
      .catch(() => setConnection({ connected: false, host: "" }));
  }, []);

  useEffect(() => {
    checkConnection();
    // Listen for connection changes from Settings page
    window.addEventListener("skywalker-connection-changed", checkConnection);
    return () => window.removeEventListener("skywalker-connection-changed", checkConnection);
  }, [checkConnection]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-border px-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
            style={{
              backgroundColor: connection.connected ? "#00ff87" : "#ff3366",
              boxShadow: connection.connected
                ? "0 0 4px #00ff87, 0 0 8px #00ff8780, 0 0 16px #00ff8740, 0 0 24px #00ff8720"
                : "0 0 4px #ff3366, 0 0 8px #ff336680, 0 0 16px #ff336640",
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
