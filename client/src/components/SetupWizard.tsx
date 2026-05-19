import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Plug, Shield, Zap } from "lucide-react";

interface Props {
  initialBaseUrl: string;
  onConnected: () => void;
}

export function SetupWizard({ initialBaseUrl, onConnected }: Props) {
  const navigate = useNavigate();
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl || "https://127.0.0.1:8089");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [connected, setConnected] = useState(false);

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
      if (data.status === "ok" || data.status === "warning") {
        setConnected(true);
        setMessage({ type: "ok", text: `Connected — ${data.message || "ready"}` });
        window.dispatchEvent(new Event("skywalker-connection-changed"));
        setTimeout(() => {
          onConnected();
          navigate("/shc", { replace: true });
        }, 900);
      } else {
        setMessage({ type: "error", text: data.message || "Connection failed" });
      }
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md mx-4">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-500/30 mb-3">
            <Zap size={22} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Skywalker</h1>
          <p className="text-sm text-gray-500 mt-1">Connect to your Splunk instance to get started</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <Shield size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-white">Splunk Connection</h2>
            <span className="text-[10px] text-gray-600 ml-auto">token held in memory only</span>
          </div>

          {/* URL */}
          <label className="block mb-4">
            <span className="text-xs font-medium text-gray-400 mb-1.5 block">Splunk REST API URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors"
              placeholder="https://your-splunk-sh:8089"
              disabled={connected}
            />
            <p className="text-[10px] text-gray-600 mt-1">Management port (8089), not the web UI (8000)</p>
          </label>

          {/* Token */}
          <label className="block mb-5">
            <span className="text-xs font-medium text-gray-400 mb-1.5 block">API Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors"
              placeholder="Paste your Splunk API token"
              disabled={connected}
              autoFocus
            />
            <p className="text-[10px] text-gray-600 mt-1">
              Settings → Tokens → New Token in Splunk Web
            </p>
          </label>

          {/* Message */}
          {message && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm mb-4 ${
              message.type === "ok"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}>
              {message.type === "ok" ? <CheckCircle size={15} /> : <XCircle size={15} />}
              {message.text}
            </div>
          )}

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={saving || connected || !token.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : connected ? <CheckCircle size={15} /> : <Plug size={15} />}
            {connected ? "Connected — loading SHC…" : saving ? "Connecting…" : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
