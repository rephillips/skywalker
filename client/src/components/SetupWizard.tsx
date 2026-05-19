import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, Plug, Shield, Zap } from "lucide-react";

type WizardState = "checking" | "form" | "success";

export function SetupWizard({ onConnected }: { onConnected: () => void }) {
  const [wizState, setWizState] = useState<WizardState>("checking");
  const [baseUrl, setBaseUrl] = useState("https://35.169.157.99:8089");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // On mount: test existing connection — auto-proceed if it works
  useEffect(() => {
    async function autoCheck() {
      try {
        const [cfg, test] = await Promise.all([
          fetch("/api/config").then((r) => r.json()),
          fetch("/api/config/test", { method: "POST" }).then((r) => r.json()),
        ]);
        if (cfg.baseUrl && !cfg.baseUrl.includes("127.0.0.1")) {
          setBaseUrl(cfg.baseUrl);
        }
        if (test.status === "ok") {
          setSuccessMsg(`Connected to ${test.serverName || cfg.baseUrl}`);
          setWizState("success");
          setTimeout(() => onConnected(), 1000);
        } else {
          setWizState("form");
        }
      } catch {
        setWizState("form");
      }
    }
    autoCheck();
  }, []);

  async function handleConnect() {
    if (!token.trim()) { setError("Enter an API token"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token }),
      });
      const data = await res.json();
      if (data.status === "ok" || data.status === "warning") {
        setSuccessMsg(data.message || "Connected");
        setWizState("success");
        window.dispatchEvent(new Event("skywalker-connection-changed"));
        setTimeout(() => onConnected(), 900);
      } else {
        setError(data.message || "Connection failed");
      }
    } catch (err) {
      setError((err as Error).message);
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
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-500/30 mb-3">
            <Zap size={22} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Skywalker</h1>
          <p className="text-sm text-gray-500 mt-1">
            {wizState === "checking" ? "Checking connection…" : wizState === "success" ? "Connection verified" : "Connect to your Splunk instance"}
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">

          {/* Checking state */}
          {wizState === "checking" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={28} className="animate-spin text-brand-400" />
              <p className="text-sm text-gray-400">Verifying existing connection…</p>
            </div>
          )}

          {/* Success state */}
          {wizState === "success" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle size={28} className="text-emerald-400" />
              <p className="text-sm text-emerald-300 font-medium">{successMsg}</p>
              <p className="text-xs text-gray-500">Loading dashboard…</p>
            </div>
          )}

          {/* Form state */}
          {wizState === "form" && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <Shield size={15} className="text-brand-400" />
                <h2 className="text-sm font-semibold text-white">Splunk Connection</h2>
                <span className="text-[10px] text-gray-600 ml-auto">token held in memory only</span>
              </div>

              <label className="block mb-4">
                <span className="text-xs font-medium text-gray-400 mb-1.5 block">Splunk REST API URL</span>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors"
                  placeholder="https://your-splunk-sh:8089"
                />
                <p className="text-[10px] text-gray-600 mt-1">Management port (8089), not the web UI (8000)</p>
              </label>

              <label className="block mb-5">
                <span className="text-xs font-medium text-gray-400 mb-1.5 block">API Token</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors"
                  placeholder="Paste your Splunk API token"
                  autoFocus
                />
                <p className="text-[10px] text-gray-600 mt-1">Settings → Tokens → New Token in Splunk Web</p>
              </label>

              {error && (
                <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm mb-4 bg-red-500/10 border border-red-500/20 text-red-400">
                  <XCircle size={15} /> {error}
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={saving || !token.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}
                {saving ? "Connecting…" : "Connect"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
