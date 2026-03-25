import { useState, useEffect } from "react";
import { TopBar } from "../components/layout/TopBar";
import { CheckCircle, XCircle, Loader2, Plug, Info } from "lucide-react";

interface SplunkConfig {
  baseUrl: string;
  username: string;
  hasPassword: boolean;
  hasToken: boolean;
  authMode: "token" | "basic";
}

export function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [authMode, setAuthMode] = useState<"basic" | "token">("basic");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        setUsername(cfg.username);
        setAuthMode(cfg.authMode);
        setEnvConfig(cfg);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = { baseUrl };
      if (authMode === "token") {
        body.token = token;
        body.password = "";
      } else {
        body.username = username;
        body.password = password;
        body.token = "";
      }
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessage({ type: data.status, text: data.message });
      // Refresh config state
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

  if (!loaded) return null;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Settings" />
      <div className="p-6 max-w-2xl">
        {/* Current connection status */}
        {envConfig && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mb-4">
            <div className="flex items-start gap-3">
              <Info size={16} className="shrink-0 text-brand-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-white mb-2">Active Connection</p>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20">URL</span>
                    <code className="text-gray-300 font-mono">{envConfig.baseUrl}</code>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20">Auth</span>
                    <span className="text-gray-300">
                      {envConfig.authMode === "token" ? (
                        <>API Token <span className="text-emerald-400">configured</span></>
                      ) : (
                        <>
                          Username: <code className="font-mono">{envConfig.username}</code>
                          {envConfig.hasPassword ? (
                            <span className="text-emerald-400 ml-2">password set</span>
                          ) : (
                            <span className="text-amber-400 ml-2">no password</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20">Source</span>
                    <span className="text-gray-400">Loaded from .env file</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Splunk Connection</h2>
          <p className="text-sm text-gray-500 mb-6">
            Update the connection settings below. Changes apply immediately but reset on server restart.
            For persistent changes, edit the <code className="text-gray-400 font-mono text-xs">.env</code> file.
          </p>

          {/* Base URL */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-300 mb-1.5 block">Splunk REST API URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500 transition-colors"
              placeholder="https://127.0.0.1:8089"
            />
          </label>

          {/* Auth mode toggle */}
          <div className="mb-4">
            <span className="text-sm font-medium text-gray-300 mb-2 block">Authentication Method</span>
            <div className="flex gap-2">
              <button
                onClick={() => setAuthMode("basic")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authMode === "basic"
                    ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                    : "bg-surface border border-surface-border text-gray-400 hover:text-gray-200"
                }`}
              >
                Username / Password
              </button>
              <button
                onClick={() => setAuthMode("token")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authMode === "token"
                    ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                    : "bg-surface border border-surface-border text-gray-400 hover:text-gray-200"
                }`}
              >
                API Token
              </button>
            </div>
          </div>

          {/* Auth fields */}
          {authMode === "basic" ? (
            <div className="flex gap-4 mb-6">
              <label className="flex-1">
                <span className="text-sm font-medium text-gray-300 mb-1.5 block">Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500 transition-colors"
                />
              </label>
              <label className="flex-1">
                <span className="text-sm font-medium text-gray-300 mb-1.5 block">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500 transition-colors"
                  placeholder={envConfig?.hasPassword ? "••••••••  (already set)" : "Enter password"}
                />
              </label>
            </div>
          ) : (
            <label className="block mb-6">
              <span className="text-sm font-medium text-gray-300 mb-1.5 block">Splunk API Token</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500 transition-colors font-mono"
                placeholder={envConfig?.hasToken ? "••••••••  (already set from .env)" : "eyJra..."}
              />
              <p className="text-xs text-gray-500 mt-1.5">
                {envConfig?.hasToken
                  ? "A token is already configured. Leave blank to keep the current token, or enter a new one to replace it."
                  : "Generate a token in Splunk: Settings \u2192 Tokens \u2192 New Token"}
              </p>
            </label>
          )}

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
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Configuration
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
      </div>
    </div>
  );
}
