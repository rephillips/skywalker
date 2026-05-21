import { useState, useEffect } from "react";
import { TopBar } from "../components/layout/TopBar";
import { CheckCircle, XCircle, Loader2, Plug, Info, Shield, AlertTriangle, Database, Trash2 } from "lucide-react";
import { queryCache, DEFAULT_CACHE_TTL } from "../services/cache";

interface SplunkConfig {
  baseUrl: string;
  webUrl: string;
  username: string;
  hasPassword: boolean;
  hasToken: boolean;
  authMode: "token" | "basic";
}

export function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState("https://127.0.0.1:8089");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [envConfig, setEnvConfig] = useState<SplunkConfig | null>(null);
  const [splunkReachable, setSplunkReachable] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error" | "warning"; text: string } | null>(null);

  const noCache = { "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" };

  const checkConnection = async () => {
    try {
      const cfg: SplunkConfig = await fetch("/api/config", { headers: noCache }).then(r => r.json());
      setBaseUrl(cfg.baseUrl);
      setEnvConfig(cfg);
      if (cfg.hasToken || cfg.hasPassword) {
        const health = await fetch("/api/health", { headers: noCache }).then(r => r.json());
        setSplunkReachable(health.splunk === "reachable");
      } else {
        setSplunkReachable(false);
      }
    } catch {
      setSplunkReachable(false);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    checkConnection();
    window.addEventListener("skywalker-connection-changed", checkConnection);
    return () => window.removeEventListener("skywalker-connection-changed", checkConnection);
  }, []);

  async function handleConnect() {
    if (!token.trim()) {
      setMessage({ type: "error", text: "Enter an API token" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token }),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      await checkConnection();
      window.dispatchEvent(new Event("skywalker-connection-changed"));
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/config/test", { method: "POST" });
      const data = await res.json();
      if (data.status === "ok") {
        setMessage({ type: "ok", text: `Connected to Splunk server: ${data.serverName}` });
      } else {
        setMessage({ type: "error", text: data.message });
      }
      window.dispatchEvent(new Event("skywalker-connection-changed"));
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token: "" }),
      });
      setToken("");
      await checkConnection();
      setMessage({ type: "ok", text: "Token cleared from memory" });
      window.dispatchEvent(new Event("skywalker-connection-changed"));
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  }

  if (!loaded) return null;

  const hasCredentials = !!(envConfig?.hasToken || envConfig?.hasPassword);
  const isConnected = hasCredentials && splunkReachable;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Settings" />
      <div className="p-6 max-w-2xl">

        {/* Connection status */}
        <div className={`rounded-xl border p-4 mb-6 ${
          isConnected
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-amber-500/30 bg-amber-500/5"
        }`}>
          <div className="flex items-start gap-3">
            {isConnected ? (
              <CheckCircle size={18} className="shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
            )}
            <div className="text-sm">
              <p className="font-medium text-white mb-1">
                {isConnected ? "Connected" : "Not Connected"}
              </p>
              {isConnected && envConfig && (
                <div className="flex flex-col gap-0.5 text-xs text-gray-400">
                  <span>URL: <code className="font-mono text-gray-300">{envConfig.baseUrl}</code></span>
                  <span>Auth: {envConfig.authMode === "token" ? "API Token" : `Basic (${envConfig.username})`}</span>
                </div>
              )}
              {!isConnected && (
                <p className="text-xs text-gray-400">Enter your Splunk REST API URL and a temporary API token to connect.</p>
              )}
            </div>
            {isConnected && (
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => {
                    setToken("");
                    setBaseUrl("https://");
                    setMessage(null);
                  }}
                  className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-300 hover:bg-surface-hover transition-colors"
                >
                  New Connection
                </button>
                <button
                  onClick={handleDisconnect}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Clear &amp; Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Connect form */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Splunk Connection</h2>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Token is held in server memory only — never written to disk. Expires when the server restarts or you disconnect.
          </p>

          {/* Splunk URL */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-300 mb-1.5 block">Splunk REST API URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors"
              placeholder="https://your-splunk-sh:8089"
            />
            <p className="text-[10px] text-gray-600 mt-1">Management port (8089), not the web UI port (8000)</p>
          </label>

          {/* API Token */}
          <label className="block mb-6">
            <span className="text-sm font-medium text-gray-300 mb-1.5 block">API Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors"
              placeholder={envConfig?.hasToken ? "••••••••  (token active in memory)" : "Paste your Splunk API token"}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            <p className="text-[10px] text-gray-600 mt-1.5">
              Generate in Splunk: Settings → Tokens → New Token. Token stays in memory only.
            </p>
          </label>

          {/* Status message */}
          {message && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm mb-4 ${
                message.type === "ok"
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : message.type === "warning"
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {message.type === "ok" ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConnect}
              disabled={saving || !token.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Connect
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-gray-300 hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              Test Connection
            </button>
          </div>
        </div>

        {/* Security info */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mt-4">
          <div className="flex items-start gap-2">
            <Info size={14} className="shrink-0 text-gray-500 mt-0.5" />
            <div className="text-[10px] text-gray-500 space-y-1">
              <p>Token is stored in Node.js process memory only — not written to .env or any file.</p>
              <p>Token is cleared when the server restarts or you click Disconnect.</p>
              <p>For persistent config, edit the .env file directly with SPLUNK_TOKEN=...</p>
              <p>All Splunk API calls are proxied through the Node.js backend — your browser never sees the token.</p>
            </div>
          </div>
        </div>

        {/* Query cache */}
        <CachePanel />
      </div>
    </div>
  );
}

function CachePanel() {
  const [snapshot, setSnapshot] = useState(() => queryCache.snapshot());

  const refresh = () => setSnapshot(queryCache.snapshot());

  const clearAll = () => {
    queryCache.clear();
    refresh();
  };

  const ttlMins = DEFAULT_CACHE_TTL / 60_000;
  const now = Date.now();

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-brand-400" />
          <h3 className="text-sm font-semibold text-white">Query Cache</h3>
          <span className="rounded-full bg-brand-500/20 text-brand-300 text-[9px] px-1.5 py-0.5 leading-none font-medium">
            {snapshot.length} entr{snapshot.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
            Refresh
          </button>
          <button
            onClick={clearAll}
            disabled={snapshot.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
          >
            <Trash2 size={10} />
            Clear all
          </button>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mb-3">
        Splunk query results are cached in browser memory for {ttlMins} minutes. Navigating between pages
        reuses cached results instead of re-running searches. Each page's Refresh button busts its own entries.
        Results are never written to disk and are cleared on tab close or server restart.
      </p>

      {snapshot.length === 0 ? (
        <p className="text-[11px] text-gray-600 italic">No cached entries.</p>
      ) : (
        <div className="overflow-auto max-h-56">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-surface-border text-[9px] uppercase tracking-wide text-gray-500">
                <th className="text-left px-2 py-1.5 font-medium">Query key</th>
                <th className="text-right px-2 py-1.5 font-medium w-32 whitespace-nowrap">Cached at</th>
                <th className="text-right px-2 py-1.5 font-medium w-24 whitespace-nowrap">Expires in</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.map((e, i) => {
                const secsLeft = Math.max(0, Math.round((e.expiresAt - now) / 1000));
                const minsLeft = Math.floor(secsLeft / 60);
                const secsPart = secsLeft % 60;
                return (
                  <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20">
                    <td className="px-2 py-1 font-mono text-gray-400 break-all">{e.key}</td>
                    <td className="px-2 py-1 font-mono text-gray-500 text-right whitespace-nowrap">
                      {e.cachedAt.toLocaleTimeString()}
                    </td>
                    <td className={`px-2 py-1 font-mono text-right whitespace-nowrap ${secsLeft < 60 ? "text-amber-400" : "text-gray-500"}`}>
                      {minsLeft > 0 ? `${minsLeft}m ${secsPart}s` : `${secsLeft}s`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
