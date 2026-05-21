import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, Plug, Shield, Zap } from "lucide-react";

function playErrorBuzz() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // Two descending droid-style beeps — pitch drops, square wave, harsh
    [0, 0.22].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(380 - i * 60, now + offset);
      osc.frequency.exponentialRampToValueAtTime(160 - i * 30, now + offset + 0.18);
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });

    // Low rumble underneath — sawtooth drone that decays
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(90, now);
    drone.frequency.exponentialRampToValueAtTime(55, now + 0.45);
    droneGain.gain.setValueAtTime(0.08, now);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    drone.connect(droneGain);
    droneGain.connect(ctx.destination);
    drone.start(now);
    drone.stop(now + 0.45);

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Web Audio API unavailable — silently skip
  }
}

function playLightsaberSwoosh() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    const dur = 0.75;

    // Sawtooth tone — sweeps up then settles (the hum + ignite)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(340, now + dur);
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.28, now + 0.04);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);

    // Noise layer — bandpass-filtered whoosh
    const bufLen = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(500, now + dur);
    filter.Q.value = 1.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);

    setTimeout(() => ctx.close(), (dur + 0.1) * 1000);
  } catch {
    // Web Audio API unavailable — silently skip
  }
}

type WizardState = "checking" | "form" | "success" | "warning";

export function SetupWizard({ onConnected }: { onConnected: () => void }) {
  const [wizState, setWizState] = useState<WizardState>("checking");
  const [baseUrl, setBaseUrl] = useState("https://35.169.157.99:8089");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [slowHint, setSlowHint] = useState(false);

  // On mount: test existing connection — auto-proceed if it works
  useEffect(() => {
    async function autoCheck() {
      try {
        const noCache = { "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" };
        const [cfg, test] = await Promise.all([
          fetch("/api/config", { headers: noCache }).then((r) => r.json()),
          fetch("/api/config/test", { method: "POST", headers: noCache }).then((r) => r.json()),
        ]);
        if (cfg.baseUrl && !cfg.baseUrl.includes("127.0.0.1")) {
          setBaseUrl(cfg.baseUrl);
        }
        if (test.status === "ok") {
          setSuccessMsg(`Connected to ${test.serverName || cfg.baseUrl}`);
          setWizState("success");
          playLightsaberSwoosh();
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
    setSlowHint(false);
    const slowTimer = setTimeout(() => setSlowHint(true), 8_000);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setSuccessMsg(data.message || "Connected");
        setWizState("success");
        playLightsaberSwoosh();
        window.dispatchEvent(new Event("skywalker-connection-changed"));
        setTimeout(() => onConnected(), 900);
      } else if (data.status === "warning") {
        // Config IS saved; the verification call to Splunk failed (TLS hiccup,
        // transient network issue, etc.) but the token is in memory. Proceed
        // with a warning so the user can still use the app.
        setSuccessMsg(data.message || "Config saved — connection could not be verified");
        setWizState("warning");
        window.dispatchEvent(new Event("skywalker-connection-changed"));
        setTimeout(() => onConnected(), 1400);
      } else {
        // Hard failure — config may not be saved; stay on the form.
        playErrorBuzz();
        setError(data.message || "Connection failed — check the URL and token");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearTimeout(slowTimer);
      setSlowHint(false);
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
            {wizState === "checking" ? "Checking connection…" : wizState === "success" ? "Connection verified" : wizState === "warning" ? "Config saved" : "Connect to your Splunk instance"}
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
              <p className="text-xs text-gray-500">Loading…</p>
            </div>
          )}

          {/* Warning state — config saved but verification failed */}
          {wizState === "warning" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-7 h-7 rounded-full border-2 border-amber-400 flex items-center justify-center">
                <span className="text-amber-400 text-sm font-bold">!</span>
              </div>
              <p className="text-sm text-amber-300 font-medium text-center">{successMsg}</p>
              <p className="text-xs text-gray-500">Proceeding to app…</p>
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

              {slowHint && (
                <p className="text-center text-[11px] text-amber-400/80 animate-pulse">
                  Still waiting — Splunk may be under heavy load (up to 60s)
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
