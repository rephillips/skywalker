import { useState, useEffect, useCallback, useRef } from "react";
import { Network, RefreshCw, Loader2, SearchCode, Crown, CheckCircle2, XCircle, AlertTriangle, Gauge } from "lucide-react";
import { LineChart } from "@tremor/react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";

function formatDurationSince(epochSecs: number): string {
  if (!epochSecs) return "—";
  const ms = Date.now() - epochSecs * 1000;
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function FlagPill({ on, label, invert }: { on: boolean; label: string; invert?: boolean }) {
  const good = invert ? !on : on;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${good ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
      {good ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

function ClusterStatusPanel() {
  const [captain, setCaptain] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, membersRes] = await Promise.all([
        api.proxy("shcluster/status"),
        api.proxy("shcluster/member/members"),
      ]);
      if (statusRes.status === "error") throw new Error(statusRes.message || "shcluster/status failed");
      if (membersRes.status === "error") throw new Error(membersRes.message || "shcluster/member/members failed");
      const captainEntry = statusRes.data?.entry?.find((e: any) => e.name === "captain") || statusRes.data?.entry?.[0];
      setCaptain(captainEntry?.content ?? null);
      setMembers(membersRes.data?.entry ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const captainLabel = captain?.label || captain?.peer_scheme_host_port || "unknown";
  const electedSecs = Number(captain?.elected_captain || 0);
  const dynamic = captain?.dynamic_captain === "1" || captain?.dynamic_captain === true;
  const serviceReady = captain?.service_ready_flag === "1" || captain?.service_ready_flag === true;
  const rollingRestart = captain?.rolling_restart_flag === "1" || captain?.rolling_restart_flag === true;
  const initialized = captain?.initialized_flag === "1" || captain?.initialized_flag === true;

  return (
    <div className="mb-6 rounded-xl border border-surface-border bg-surface-raised">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Crown size={14} className="text-amber-400" />
          <h3 className="text-xs font-semibold text-white">Cluster Status</h3>
          <span className="text-[10px] text-gray-500">via /services/shcluster/status</span>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          Refresh
        </button>
      </div>

      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {!error && loading && !captain && (
        <div className="p-6 text-center">
          <Loader2 size={20} className="mx-auto mb-2 text-brand-400 animate-spin" />
          <p className="text-[11px] text-gray-500">Loading cluster status...</p>
        </div>
      )}

      {!error && captain && (
        <>
          {/* Captain summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 border-b border-surface-border">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Captain</div>
              <div className="text-sm font-semibold text-amber-300 truncate" title={captainLabel}>{captainLabel}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Elected</div>
              <div className="text-sm text-gray-200">{formatDurationSince(electedSecs)} ago</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Members</div>
              <div className="text-sm text-gray-200">{members.length}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Mode</div>
              <div className="text-sm text-gray-200">{dynamic ? "Dynamic" : "Static"}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FlagPill on={serviceReady} label="Service ready" />
              <FlagPill on={initialized} label="Initialized" />
              <FlagPill on={rollingRestart} label="Rolling restart" invert />
            </div>
          </div>

          {/* Members table */}
          {members.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wide text-gray-500 border-b border-surface-border">
                    <th className="px-4 py-2 font-medium">Label</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Site</th>
                    <th className="px-4 py-2 font-medium">Host:Port</th>
                    <th className="px-4 py-2 font-medium">Replication Port</th>
                    <th className="px-4 py-2 font-medium">Last Heartbeat</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m: any) => {
                    const c = m.content || {};
                    const isCaptain = c.label === captain?.label;
                    const status = c.status || "Unknown";
                    const statusUp = status === "Up";
                    const hbSecs = Number(c.last_heartbeat || 0);
                    return (
                      <tr key={m.name} className="border-b border-surface-border/50 last:border-0 hover:bg-surface-hover/30">
                        <td className="px-4 py-2 font-medium text-gray-200">
                          <div className="flex items-center gap-1.5">
                            {isCaptain && <Crown size={11} className="text-amber-400" />}
                            {c.label || m.name}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 ${statusUp ? "text-emerald-400" : "text-rose-400"}`}>
                            {statusUp ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-400">{c.site || "—"}</td>
                        <td className="px-4 py-2 text-gray-400 font-mono text-[10px]">{c.host_port_pair || "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{c.replication_port || "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{hbSecs ? `${formatDurationSince(hbSecs)} ago` : "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{isCaptain ? "Captain" : "Member"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const BASE_SPL = `index=_internal sourcetype=splunkd group=searchscheduler host IN (sh*)
| eval state=if(delegated>0, "captain", "non-captain")
| search state="captain"
| timechart span=SPAN distinct_count(state) by host`;

const RANGE_CONFIG: Record<string, { span: string; fmt: Intl.DateTimeFormatOptions }> = {
  "-1h":  { span: "1m",  fmt: { hour: "2-digit", minute: "2-digit" } },
  "-4h":  { span: "5m",  fmt: { hour: "2-digit", minute: "2-digit" } },
  "-24h": { span: "30m", fmt: { hour: "2-digit", minute: "2-digit" } },
  "-7d":  { span: "4h",  fmt: { month: "short", day: "numeric", hour: "2-digit" } },
};

const NEON_COLORS = ["emerald", "cyan", "fuchsia", "amber", "violet", "rose", "teal", "indigo"];

function UsageBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const color = pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = pct >= 90 ? "text-rose-400" : pct >= 75 ? "text-amber-400" : "text-emerald-400";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-[11px] font-mono">
          <span className={textColor}>{used}</span>
          <span className="text-gray-500"> / {total || "∞"}</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FlipCard({ front, back }: { front: React.ReactNode; back: React.ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className="cursor-pointer select-none"
      style={{ perspective: "900px", height: "158px" }}
      onClick={() => setFlipped(f => !f)}
    >
      <div style={{
        position: "relative", width: "100%", height: "100%",
        transformStyle: "preserve-3d",
        transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
      }}>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>{front}</div>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>{back}</div>
      </div>
    </div>
  );
}

function CardFront({ title, value, subtitle, accent = "text-white" }: { title: string; value: string | number; subtitle: string; accent?: string }) {
  return (
    <div className="h-full rounded-xl border border-surface-border bg-surface-raised flex flex-col justify-between p-3">
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{title}</div>
      <div className={`text-4xl font-bold font-mono ${accent}`}>{value}</div>
      <div className="flex items-end justify-between">
        <div className="text-[9px] text-gray-600 leading-relaxed">{subtitle}</div>
        <div className="text-[9px] text-brand-500 shrink-0 ml-2">flip for formula ↻</div>
      </div>
    </div>
  );
}

function CardBack({ title, formula, substituted, description }: { title: string; formula: string; substituted: string; description: string }) {
  return (
    <div className="h-full rounded-xl border border-brand-500/30 bg-surface-raised flex flex-col justify-between p-3">
      <div className="text-[9px] uppercase tracking-wide text-brand-400">{title}</div>
      <pre className="text-[10px] font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">{formula}</pre>
      <div>
        <div className="text-[10px] font-mono text-gray-300">{substituted}</div>
        <div className="text-[9px] text-gray-600 mt-1">{description}</div>
      </div>
    </div>
  );
}

function ConcurrencyPanel() {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [concurrencyRes, searchConfRes, schedulerConfRes] = await Promise.all([
        api.proxy("server/status/limits/search-concurrency?cluster_wide_quota=1"),
        api.proxy("configs/conf-limits/search"),
        api.proxy("configs/conf-limits/scheduler"),
      ]);
      if (concurrencyRes.status === "error") throw new Error(concurrencyRes.message || "search-concurrency failed");

      const concurrency = concurrencyRes.data?.entry?.[0]?.content ?? {};
      // Prefer conf-limits values (what's actually configured) over runtime-derived
      const searchConf = searchConfRes.status === "ok" ? (searchConfRes.data?.entry?.[0]?.content ?? {}) : {};
      const schedConf  = schedulerConfRes.status === "ok" ? (schedulerConfRes.data?.entry?.[0]?.content ?? {}) : {};

      setContent({
        ...concurrency,
        // Overlay with authoritative conf values where available
        ...(searchConf.base_max_searches    !== undefined && { base_max_searches:    searchConf.base_max_searches }),
        ...(searchConf.max_searches_per_cpu !== undefined && { max_searches_per_cpu: searchConf.max_searches_per_cpu }),
        ...(schedConf.max_searches_perc     !== undefined && { max_searches_perc:    schedConf.max_searches_perc }),
        ...(schedConf.auto_summary_perc     !== undefined && { auto_summary_perc:    schedConf.auto_summary_perc }),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const num = (k: string) => Number(content?.[k] ?? 0);

  // Derive computed values from raw fields
  const maxPerCpu      = num("max_searches_per_cpu");
  const baseMax        = num("base_max_searches");
  const maxHist        = num("max_hist_searches");                    // per-node total
  const clusterTotal   = num("cluster_wide_max_hist_searches") || maxHist;
  const members        = maxHist > 0 ? Math.round(clusterTotal / maxHist) : 1;
  const cpus           = maxPerCpu > 0 ? Math.round((maxHist - baseMax) / maxPerCpu) : 0;

  // max_searches_perc comes back as a decimal (0.5) from the REST API
  const rawPerc        = num("max_searches_perc");
  const schedPerc      = rawPerc > 1 ? rawPerc / 100 : rawPerc;      // normalise
  const rawAutoPerc    = num("auto_summary_perc");
  const autoPerc       = rawAutoPerc > 1 ? rawAutoPerc / 100 : rawAutoPerc;

  const perNodeSched   = Math.floor(maxHist * schedPerc);
  const clusterSched   = perNodeSched * members;
  const perNodeAuto    = Math.floor(perNodeSched * autoPerc);
  const clusterAuto    = perNodeAuto * members;

  const schedPct       = Math.round(schedPerc * 100);
  const autoPct        = Math.round(autoPerc * 100);

  return (
    <div className="mb-6 rounded-xl border border-surface-border bg-surface-raised">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-cyan-400" />
          <h3 className="text-xs font-semibold text-white">Search Concurrency Limits</h3>
          <span className="text-[10px] text-gray-500">search-concurrency + conf-limits/search + conf-limits/scheduler · click cards to see formula</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRaw(s => !s)} className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors">
            {showRaw ? "Hide raw" : "Show raw"}
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {!error && loading && !content && (
        <div className="p-6 text-center">
          <Loader2 size={20} className="mx-auto mb-2 text-brand-400 animate-spin" />
          <p className="text-[11px] text-gray-500">Loading concurrency limits...</p>
        </div>
      )}

      {!error && content && (
        <>
          {/* Flip cards — quota limits */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-surface-border">
            <FlipCard
              front={
                <CardFront
                  title="Cluster Total Slots"
                  value={clusterTotal}
                  subtitle={`Adhoc + scheduled across ${members} member${members !== 1 ? "s" : ""}`}
                  accent="text-cyan-300"
                />
              }
              back={
                <CardBack
                  title="Cluster Total Slots"
                  formula={`(max_searches_per_cpu × CPUs\n + base_max_searches) × members`}
                  substituted={`(${maxPerCpu} × ${cpus} + ${baseMax}) × ${members} = ${clusterTotal}`}
                  description="Total concurrent searches (adhoc + scheduled) across the deployment"
                />
              }
            />
            <FlipCard
              front={
                <CardFront
                  title="Cluster Scheduled"
                  value={clusterSched}
                  subtitle={`${schedPct}% of cluster total, ${perNodeSched} per node`}
                  accent="text-violet-300"
                />
              }
              back={
                <CardBack
                  title="Cluster Scheduled"
                  formula={`⌊(max_searches_per_cpu × CPUs\n + base_max_searches)\n × max_searches_perc⌋ × members`}
                  substituted={`⌊(${maxPerCpu}×${cpus}+${baseMax}) × ${schedPct}%⌋ × ${members} = ${clusterSched}`}
                  description="Max scheduled searches the captain will distribute cluster-wide"
                />
              }
            />
            <FlipCard
              front={
                <CardFront
                  title="Cluster Auto-Summary"
                  value={clusterAuto}
                  subtitle={`${autoPct}% of scheduled, ${perNodeAuto} per node`}
                  accent="text-amber-300"
                />
              }
              back={
                <CardBack
                  title="Cluster Auto-Summary"
                  formula={`⌊(scheduled_per_node\n × auto_summary_perc)⌋ × members`}
                  substituted={`⌊${perNodeSched} × ${autoPct}%⌋ × ${members} = ${clusterAuto}`}
                  description="Slots reserved for report acceleration & data model acceleration"
                />
              }
            />
            <FlipCard
              front={
                <CardFront
                  title="Per-Node Total"
                  value={maxHist}
                  subtitle={`${cpus} CPUs × ${maxPerCpu} + ${baseMax} base`}
                  accent="text-emerald-300"
                />
              }
              back={
                <CardBack
                  title="Per-Node Total"
                  formula={`max_searches_per_cpu × CPUs\n+ base_max_searches`}
                  substituted={`${maxPerCpu} × ${cpus} + ${baseMax} = ${maxHist}`}
                  description="Max concurrent searches on a single search head member"
                />
              }
            />
          </div>

          {/* Active usage bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-4 border-b border-surface-border">
            <UsageBar label="Active historical (this node)" used={num("active_hist_searches")} total={maxHist} />
            <UsageBar label="Active real-time (this node)" used={num("active_realtime_searches")} total={num("max_rt_searches")} />
            <UsageBar label="Active scheduled (this node)" used={num("active_scheduled_searches")} total={perNodeSched} />
          </div>

          {showRaw && (
            <div className="p-3">
              <pre className="text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all max-h-64 overflow-auto bg-surface rounded p-2">
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SHCPage() {
  const [spl, setSpl] = useState(BASE_SPL.replace("SPAN", "5m"));
  const [chartData, setChartData] = useState<Record<string, string | number>[]>([]);
  const [chartCategories, setChartCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("-4h");
  const [span, setSpan] = useState("5m");
  const [showInfo, setShowInfo] = useState(false);
  const [editingSpl, setEditingSpl] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (opts?: { searchSpl?: string; range?: string; spanOverride?: string }) => {
    setLoading(true);
    setError(null);
    const effectiveRange = opts?.range || timeRange;
    const effectiveSpan = opts?.spanOverride || span;
    const cfg = RANGE_CONFIG[effectiveRange] || RANGE_CONFIG["-4h"];
    const effectiveSpl = (opts?.searchSpl || spl).replace(/span=\S+/, `span=${effectiveSpan}`);
    try {
      const res = await api.search(effectiveSpl, effectiveRange, "now");
      if (res.results?.length > 0) {
        const keys = Object.keys(res.results[0]).filter((k) => k !== "_time" && !k.startsWith("_"));
        setChartCategories(keys);
        setChartData(res.results.map((row) => {
          const point: Record<string, string | number> = {
            _time: new Date(row._time).toLocaleString([], cfg.fmt),
          };
          keys.forEach((k) => { point[k] = Number(row[k]) || 0; });
          return point;
        }));
      } else {
        setChartData([]);
        setChartCategories([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl, timeRange, span]);

  // Auto-run on mount
  useEffect(() => { runSearch(); }, []);

  // Close info popover on click outside
  useEffect(() => {
    if (!showInfo) return;
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showInfo]);

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Search Head Clustering" />
      <div className="p-6">
        <ClusterStatusPanel />
        <ConcurrencyPanel />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Network size={20} className="text-cyan-400" />
            <div>
              <h2 className="text-base font-semibold text-white">SHC Captain Timeline</h2>
              <p className="text-[10px] text-gray-500">Shows which search head held the captain role over time</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Range:</span>
              <select value={timeRange} onChange={(e) => { const r = e.target.value; const s = RANGE_CONFIG[r]?.span || span; setTimeRange(r); setSpan(s); runSearch({ range: r, spanOverride: s }); }}
                className="rounded border border-surface-border bg-surface px-2 py-1 text-[10px] text-gray-300 outline-none">
                <option value="-1h">1h</option>
                <option value="-4h">4h</option>
                <option value="-24h">24h</option>
                <option value="-7d">7d</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Span:</span>
              <select value={span} onChange={(e) => { setSpan(e.target.value); runSearch({ spanOverride: e.target.value }); }}
                className="rounded border border-surface-border bg-surface px-2 py-1 text-[10px] text-gray-300 outline-none">
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="10m">10m</option>
                <option value="30m">30m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
              </select>
            </div>
            <button onClick={() => runSearch()} disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-surface border border-surface-border px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
            {chartCategories.length > 0 && (
              <span className="text-[10px] text-gray-500">{chartCategories.length} hosts</span>
            )}
          </div>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Timeline Chart */}
        {loading && chartData.length === 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
            <Loader2 size={24} className="mx-auto mb-2 text-brand-400 animate-spin" />
            <p className="text-xs text-gray-500">Loading captain timeline...</p>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="-mx-6 px-4 relative">
            <div style={{ height: 220 }}>
              <LineChart
                data={chartData}
                index="_time"
                categories={chartCategories}
                colors={NEON_COLORS.slice(0, chartCategories.length)}
                yAxisWidth={32}
                showAnimation
                showLegend
                style={{ height: 220, width: "100%" }}
              />
            </div>
            {/* SPL info popover — bottom right of chart */}
            <div className="absolute bottom-2 right-6" ref={infoRef}>
              <button onClick={() => setShowInfo(!showInfo)} className="flex items-center justify-center w-6 h-6 rounded-md text-gray-600 hover:text-gray-300 hover:bg-surface-hover/60 transition-colors" title="View SPL query">
                <SearchCode size={13} />
              </button>
              {showInfo && (
                <div className="absolute right-0 bottom-8 z-50 w-[28rem] rounded-xl border border-surface-border bg-surface-raised shadow-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">SPL Query</span>
                    <div className="flex items-center gap-2">
                      <CopyButton text={spl} />
                      <button onClick={() => setEditingSpl(!editingSpl)} className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors">
                        {editingSpl ? "Cancel" : "Edit"}
                      </button>
                    </div>
                  </div>
                  {editingSpl ? (
                    <div className="flex flex-col gap-2">
                      <textarea value={spl} onChange={(e) => setSpl(e.target.value)} rows={6}
                        className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[10px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-y" spellCheck={false} />
                      <button onClick={() => { setEditingSpl(false); setShowInfo(false); runSearch(); }}
                        className="self-start rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors">Run</button>
                    </div>
                  ) : (
                    <pre className="text-[10px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all max-h-48 overflow-auto">{spl}</pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && chartData.length === 0 && !error && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
            <Network size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">No captain data found for this time range</p>
          </div>
        )}
      </div>
    </div>
  );
}
