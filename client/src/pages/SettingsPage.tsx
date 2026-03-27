import { useState, useEffect } from "react";
import { TopBar } from "../components/layout/TopBar";
import { CheckCircle, XCircle, Loader2, Plug, Info, Shield, AlertTriangle } from "lucide-react";

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
  const [message, setMessage] = useState<{ type: "ok" | "error" | "warning"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: SplunkConfig) => {
        setBaseUrl(cfg.baseUrl);
        setEnvConfig(cfg);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
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
      const updated = await fetch("/api/config").then((r) => r.json());
      setEnvConfig(updated);
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
      const updated = await fetch("/api/config").then((r) => r.json());
      setEnvConfig(updated);
      setMessage({ type: "ok", text: "Token cleared from memory" });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    }
  }

  if (!loaded) return null;

  const isConnected = envConfig?.hasToken || envConfig?.hasPassword;

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
      </div>
    </div>
  );
}
