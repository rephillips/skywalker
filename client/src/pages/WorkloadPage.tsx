import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Layers, ToggleLeft, BookOpen, ChevronDown, ChevronRight, ArrowRight, Filter, ShieldCheck } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import clsx from "clsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "1" || val.toLowerCase() === "true";
  return Boolean(val);
}

function parseNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function categoryBadgeClass(category: string): string {
  switch (category?.toLowerCase()) {
    case "search": return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
    case "ingest": return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
    default:       return "bg-gray-500/15 text-gray-400 border border-gray-500/30";
  }
}

function poolPillClass(category: string): string {
  switch (category?.toLowerCase()) {
    case "search": return "bg-blue-500/10 text-blue-300 border border-blue-500/20";
    case "ingest": return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    default:       return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeightBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
        <div className="h-full rounded-full bg-brand-500/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-gray-400 w-8 text-right shrink-0">{value}</span>
    </div>
  );
}

const ADM_RULES_COUNT_SPL = `| rest /services/workloads/status splunk_server=local | search title=admission-control-status | table title search-filter-rules.AllTime.action search-filter-rules.AllTime.predicate search-filter-rules.AllTime.user_message | stats count`;
const ADM_RULES_DETAIL_SPL = `| rest /services/workloads/status splunk_server=local | search title=admission-control-status | table title search-filter-rules.AllTime.action search-filter-rules.AllTime.predicate search-filter-rules.AllTime.user_message`;

const WLM_HOST_FILTER = `((host=sh-* AND host=*.splunk*.*) OR (host=idx-* AND host=*.splunk*.*))`; // matches Splunk Cloud SH/IDX hostnames
const WLM_COUNT_SPL = `index=_internal sourcetype=wlm_* ${WLM_HOST_FILTER} prefilter_action=filter | stats dc(search_name) as filtered_count`;
const WLM_DETAIL_SPL = `index=_internal sourcetype=wlm_* ${WLM_HOST_FILTER} prefilter_action=filter | stats count by search_name prefilter_action prefilter_rule user app search_type`;

const TIME_OPTIONS = [
  { label: "Last 15 min", value: "-15m" },
  { label: "Last 60 min", value: "-60m" },
  { label: "Last 4 hours", value: "-4h" },
  { label: "Last 24 hours", value: "-24h" },
  { label: "Last 7 days", value: "-7d" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkloadPage() {
  const [rawStatus, setRawStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);

  // Admission rules (SPL-based)
  const [admCount, setAdmCount] = useState<number | null>(null);
  const [admCountLoading, setAdmCountLoading] = useState(false);
  const [admCountError, setAdmCountError] = useState<string | null>(null);
  const [showAdmDrilldown, setShowAdmDrilldown] = useState(false);
  const [admDetails, setAdmDetails] = useState<any[]>([]);
  const [admDetailsLoading, setAdmDetailsLoading] = useState(false);
  const [admDetailsError, setAdmDetailsError] = useState<string | null>(null);

  // WLM live activity
  const [wlmEarliest, setWlmEarliest] = useState("-60m");
  const [wlmCount, setWlmCount] = useState<number | null>(null);
  const [wlmCountLoading, setWlmCountLoading] = useState(false);
  const [wlmCountError, setWlmCountError] = useState<string | null>(null);
  const [showWlmDrilldown, setShowWlmDrilldown] = useState(false);
  const [wlmDetails, setWlmDetails] = useState<any[]>([]);
  const [wlmDetailsLoading, setWlmDetailsLoading] = useState(false);
  const [wlmDetailsError, setWlmDetailsError] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.proxy("workloads/status");
      setRawStatus(res);
      if (res.status === "error") throw new Error(res.message || "Failed to fetch workload status");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    let cancelled = false;
    setAdmCountLoading(true);
    setAdmCountError(null);
    api.search(ADM_RULES_COUNT_SPL)
      .then((res) => {
        if (cancelled) return;
        const n = parseInt((res.results?.[0] as any)?.count ?? "0", 10);
        setAdmCount(isNaN(n) ? 0 : n);
      })
      .catch((err) => { if (!cancelled) setAdmCountError((err as Error).message); })
      .finally(() => { if (!cancelled) setAdmCountLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!showAdmDrilldown) return;
    let cancelled = false;
    setAdmDetailsLoading(true);
    setAdmDetailsError(null);
    api.search(ADM_RULES_DETAIL_SPL)
      .then((res) => { if (!cancelled) setAdmDetails(res.results ?? []); })
      .catch((err) => { if (!cancelled) setAdmDetailsError((err as Error).message); })
      .finally(() => { if (!cancelled) setAdmDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [showAdmDrilldown]);

  useEffect(() => {
    let cancelled = false;
    setWlmCountLoading(true);
    setWlmCountError(null);
    api.search(WLM_COUNT_SPL, wlmEarliest, "now")
      .then((res) => {
        if (cancelled) return;
        const row = res.results?.[0];
        const n = parseInt((row as any)?.filtered_count ?? "0", 10);
        setWlmCount(isNaN(n) ? 0 : n);
      })
      .catch((err) => { if (!cancelled) setWlmCountError((err as Error).message); })
      .finally(() => { if (!cancelled) setWlmCountLoading(false); });
    return () => { cancelled = true; };
  }, [wlmEarliest]);

  useEffect(() => {
    if (!showWlmDrilldown) return;
    let cancelled = false;
    setWlmDetailsLoading(true);
    setWlmDetailsError(null);
    api.search(WLM_DETAIL_SPL, wlmEarliest, "now")
      .then((res) => { if (!cancelled) setWlmDetails(res.results ?? []); })
      .catch((err) => { if (!cancelled) setWlmDetailsError((err as Error).message); })
      .finally(() => { if (!cancelled) setWlmDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [showWlmDrilldown, wlmEarliest]);

  // ── Parse data from the status response ──────────────────────────────────
  const content = rawStatus?.data?.entry?.[0]?.content ?? null;

  // enabled flag
  // Fall back to admCount as evidence of WLM being enabled when the proxy response fields don't parse
  const enabled: boolean = content
    ? parseBool(content.enabled ?? content.wlm_enabled ?? ((admCount ?? 0) > 0 ? "1" : "0"))
    : (admCount ?? 0) > 0;

  // Pools — may be nested under content.pools or content["workload_pools"] or similar
  // We'll try multiple possible shapes and fall back gracefully
  function parsePools(c: any): any[] {
    if (!c) return [];
    // Shape 1: content.pools is an array/object
    if (Array.isArray(c.pools)) return c.pools;
    if (c.pools && typeof c.pools === "object") return Object.values(c.pools);
    // Shape 2: keys like "pool.default_pool.cpu_weight" (dot-notation flat)
    const poolNames = new Set<string>();
    for (const key of Object.keys(c)) {
      const m = key.match(/^pool\.([^.]+)\./);
      if (m) poolNames.add(m[1]);
    }
    if (poolNames.size > 0) {
      return [...poolNames].map((name) => ({
        name,
        cpu_weight: parseNum(c[`pool.${name}.cpu_weight`]),
        mem_weight: parseNum(c[`pool.${name}.mem_weight`]),
        category: c[`pool.${name}.category`] ?? "misc",
        default_category_pool: parseBool(c[`pool.${name}.default_category_pool`]),
      }));
    }
    return [];
  }

  function parseRules(c: any, prefix: string): any[] {
    if (!c) return [];
    if (Array.isArray(c[prefix])) return c[prefix];
    if (c[prefix] && typeof c[prefix] === "object") return Object.values(c[prefix]);
    // Flat dot-notation: "rule.<name>.predicate"
    const names = new Set<string>();
    for (const key of Object.keys(c)) {
      const m = key.match(new RegExp(`^${prefix}\\.([^.]+)\\.`));
      if (m) names.add(m[1]);
    }
    if (names.size > 0) {
      return [...names].map((name) => ({
        name,
        predicate: c[`${prefix}.${name}.predicate`] ?? "",
        workload_pool: c[`${prefix}.${name}.workload_pool`] ?? "",
        action: c[`${prefix}.${name}.action`] ?? "",
        order: parseNum(c[`${prefix}.${name}.order`], 0),
        disabled: parseBool(c[`${prefix}.${name}.disabled`]),
      }));
    }
    return [];
  }

  const pools = parsePools(content).map((p: any) => ({
    name: p.name ?? "",
    cpu_weight: parseNum(p.cpu_weight),
    mem_weight: parseNum(p.mem_weight),
    category: p.category ?? "misc",
    default_category_pool: parseBool(p.default_category_pool),
  }));

  const rules = parseRules(content, "rules")
    .map((r: any) => ({
      name: r.name ?? "",
      predicate: r.predicate ?? "",
      workload_pool: r.workload_pool ?? "",
      order: parseNum(r.order, 0),
      disabled: parseBool(r.disabled),
    }))
    .sort((a: any, b: any) => a.order - b.order);

  const admissionRules = parseRules(content, "admission_rules")
    .map((r: any) => ({
      name: r.name ?? "",
      predicate: r.predicate ?? "",
      action: r.action ?? "",
      order: parseNum(r.order, 0),
      disabled: parseBool(r.disabled),
    }))
    .sort((a: any, b: any) => a.order - b.order);

  const poolCategoryMap = Object.fromEntries(pools.map((p) => [p.name, p.category]));
  const ruleCountByPool: Record<string, number> = {};
  for (const r of rules) {
    ruleCountByPool[r.workload_pool] = (ruleCountByPool[r.workload_pool] ?? 0) + 1;
  }

  // Only show "not configured" when both the proxy parsers AND the SPL-based count find nothing
  const notConfigured = !loading && !error && content !== null
    && pools.length === 0 && rules.length === 0 && admissionRules.length === 0
    && !admCountLoading && (admCount ?? 0) === 0;
  const noData = !loading && !error && content === null;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Workload Management" />

      <div className="p-6 flex flex-col gap-6">
        {/* ── Knowledge Card ── */}
        <section>
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <button
              onClick={() => setShowKnowledge((v) => !v)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-hover transition-colors"
            >
              <BookOpen size={15} className="text-brand-400 shrink-0" />
              <span className="text-sm font-semibold text-white flex-1">How Splunk Workload Management Works</span>
              {showKnowledge ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
            </button>

            {showKnowledge && (
              <div className="px-5 pb-6 pt-1 border-t border-surface-border flex flex-col gap-6">

                {/* Overview */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Overview</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Workload Management (WLM) gives Splunk administrators control over how CPU and memory are allocated across concurrent workloads — searches, reports, and data ingestion. Without WLM, a single expensive search can starve all other activity. WLM enforces resource fairness through three cooperating concepts: <span className="text-white font-medium">Pools</span>, <span className="text-white font-medium">Placement Rules</span>, and <span className="text-white font-medium">Admission Rules</span>.
                  </p>
                </div>

                {/* Evaluation flow */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Evaluation Order (per search)</h3>
                  <div className="flex flex-col gap-0">
                    {[
                      { step: "1", label: "Search submitted", sub: "User or scheduler dispatches a search", color: "text-gray-400", dot: "bg-gray-500" },
                      { step: "2", label: "Admission Rules evaluated", sub: "Ordered list checked top-to-bottom; first match wins. Can reject or throttle before the search ever runs.", color: "text-violet-400", dot: "bg-violet-500" },
                      { step: "3", label: "Placement Rules evaluated", sub: "Ordered list checked top-to-bottom; first match assigns the search to a named pool.", color: "text-blue-400", dot: "bg-blue-500" },
                      { step: "4", label: "Pool enforces resource share", sub: "CPU and memory weights control how much of the system this pool can use relative to other active pools.", color: "text-emerald-400", dot: "bg-emerald-500" },
                    ].map((item, i, arr) => (
                      <div key={item.step} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0", item.dot)}>{item.step}</div>
                          {i < arr.length - 1 && <div className="w-px flex-1 bg-surface-border my-0.5" />}
                        </div>
                        <div className="pb-4">
                          <p className={clsx("text-xs font-semibold", item.color)}>{item.label}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Three pillars */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Pools */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-blue-300">Workload Pools</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Resource buckets that represent a share of CPU and memory. Pools compete proportionally based on their weights — a pool with cpu_weight 50 gets roughly half the CPU versus a pool with weight 50 when both are busy.</p>
                    <ul className="text-[11px] text-gray-500 flex flex-col gap-1 list-none">
                      <li><span className="text-gray-300 font-mono">cpu_weight</span> — proportional CPU share (0–100)</li>
                      <li><span className="text-gray-300 font-mono">mem_weight</span> — proportional memory share</li>
                      <li><span className="text-gray-300 font-mono">category</span> — search or ingest</li>
                      <li><span className="text-gray-300 font-mono">default_category_pool</span> — catch-all for unmatched searches in that category</li>
                    </ul>
                  </div>

                  {/* Admission rules */}
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                      <span className="text-xs font-bold text-violet-300">Admission Rules</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Gate rules that run before a search is accepted. Useful for rejecting or queuing work that would overwhelm the system (e.g., all-time searches during peak hours).</p>
                    <ul className="text-[11px] text-gray-500 flex flex-col gap-1">
                      <li><span className="text-red-400 font-mono">reject</span> — search fails immediately with an error</li>
                      <li><span className="text-amber-400 font-mono">throttle</span> — search waits in a queue until capacity is available</li>
                      <li><span className="text-emerald-400 font-mono">allow</span> — explicitly permits the search through (overrides later deny rules)</li>
                    </ul>
                  </div>

                  {/* Placement rules */}
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                      <span className="text-xs font-bold text-cyan-300">Placement Rules</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Routing rules that map matching searches to a specific pool. Evaluated in order; the first match wins. Unmatched searches fall into the default pool for their category.</p>
                    <ul className="text-[11px] text-gray-500 flex flex-col gap-1">
                      <li><span className="text-gray-300 font-mono">predicate</span> — condition to match (e.g., role=admin)</li>
                      <li><span className="text-gray-300 font-mono">workload_pool</span> — pool to assign when matched</li>
                      <li><span className="text-gray-300 font-mono">order</span> — evaluation priority (lower = first)</li>
                    </ul>
                  </div>
                </div>

                {/* Common predicates */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Common Predicate Conditions</h3>
                  <div className="rounded-lg border border-surface-border overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-surface-border">
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Predicate</th>
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">What It Matches</th>
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Typical Use</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { pred: "search_time_range=alltime", match: "Searches with no time bound (earliest=0, latest=now or blank)", use: "Reject or throttle expensive all-time scans" },
                          { pred: "search_type=scheduled", match: "Scheduled searches (reports, alerts, dashboards)", use: "Route scheduled work to a dedicated pool" },
                          { pred: "search_type=ad_hoc", match: "Interactive ad-hoc searches", use: "Isolate analyst searches from background jobs" },
                          { pred: "role=admin", match: "Searches dispatched by users with the admin role", use: "Give admin investigations higher (or lower) priority" },
                          { pred: "user=splunk-system-user", match: "Internal system searches (summary indexing, etc.)", use: "Protect system processes with a reserved pool" },
                          { pred: "app=search", match: "Searches originating from the Search & Reporting app", use: "Separate interactive searches from app-embedded ones" },
                          { pred: "index=main", match: "Searches that reference a specific index", use: "Route high-volume index searches to a low-weight pool" },
                        ].map((row) => (
                          <tr key={row.pred} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                            <td className="px-3 py-2 whitespace-nowrap"><span className="text-[11px] font-mono text-emerald-400">{row.pred}</span></td>
                            <td className="px-3 py-2"><span className="text-[11px] text-gray-400">{row.match}</span></td>
                            <td className="px-3 py-2"><span className="text-[11px] text-gray-500">{row.use}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">Multiple conditions can be combined with AND / OR: <span className="font-mono text-gray-500">search_time_range=alltime AND role!=admin</span></p>
                </div>

                {/* REST endpoints */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">REST API Reference</h3>
                  <div className="rounded-lg border border-surface-border bg-surface/50 p-3 flex flex-col gap-1.5">
                    {[
                      { path: "GET /services/workloads/status", desc: "Full snapshot — enabled flag, all pools, all rules (used by this page)" },
                      { path: "GET /services/workloads/config", desc: "WLM enabled/disabled flag only" },
                      { path: "GET /services/workloads/pools", desc: "Pool definitions (name, weights, category)" },
                      { path: "GET /services/workloads/rules", desc: "Placement rules (predicate → pool mapping)" },
                      { path: "GET /services/workloads/admission-rules", desc: "Admission rules (predicate → action)" },
                      { path: "POST /services/workloads/config", desc: "Enable or disable WLM (requires admin)" },
                    ].map((r) => (
                      <div key={r.path} className="flex items-start gap-3">
                        <span className="text-[10px] font-mono text-blue-400/80 whitespace-nowrap shrink-0 pt-px">{r.path}</span>
                        <ArrowRight size={10} className="text-gray-600 shrink-0 mt-[3px]" />
                        <span className="text-[10px] text-gray-500">{r.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </section>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-brand-400" />
          </div>
        )}

        {!loading && error && <ErrorAlert message={error} />}

        {!loading && !error && (
          <>
            {/* ── Status banner ── */}
            <div className="rounded-xl border border-surface-border bg-surface-raised px-5 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {enabled ? (
                  <>
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Enabled</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex h-2 w-2 rounded-full bg-gray-500 shrink-0" />
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30">Disabled</span>
                  </>
                )}
              </div>
              <div className="h-4 w-px bg-surface-border shrink-0" />
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="font-semibold text-white">{pools.length}</span>
                <span>pools</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="font-semibold text-white">{rules.length}</span>
                <span>placement rules</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="font-semibold text-violet-400">
                  {admCountLoading ? <Loader2 size={12} className="animate-spin inline" /> : (admCount ?? admissionRules.length)}
                </span>
                <span>admission rules</span>
              </div>
              <div className="ml-auto">
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
              </div>
            </div>

            {/* ── Raw response inspector — always visible to debug field names ── */}
            <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
              >
                <span className="font-medium">Raw API Response — workloads/status</span>
                <span className="text-[10px] text-gray-600">{showRaw ? "▲ hide" : "▼ show"}</span>
              </button>
              {showRaw && (
                <pre className="px-4 pb-4 text-[10px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all overflow-auto max-h-96 border-t border-surface-border">
                  {JSON.stringify(rawStatus, null, 2)}
                </pre>
              )}
            </div>

            {/* ── No data parsed yet ── */}
            {(noData || notConfigured) && (
              <div className="rounded-xl border border-surface-border bg-surface-raised p-10 flex flex-col items-center gap-3 text-center">
                <ToggleLeft size={32} className="text-gray-600" />
                <p className="text-sm font-semibold text-gray-400">
                  {noData ? "No data returned from workloads/status" : "Workload Management is not configured on this instance"}
                </p>
                <p className="text-xs text-gray-600 max-w-sm">
                  Expand the Raw API Response above to see exactly what the endpoint returned and help determine the correct field structure.
                </p>
              </div>
            )}

            {/* ── Pools ── */}
            {pools.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3">Workload Pools</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pools.map((pool) => (
                    <div key={pool.name} className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold font-mono text-white truncate" title={pool.name}>{pool.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {pool.default_category_pool && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">Default</span>
                          )}
                          <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium", categoryBadgeClass(pool.category))}>
                            {pool.category || "misc"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <WeightBar label="CPU" value={pool.cpu_weight} />
                        <WeightBar label="Mem" value={pool.mem_weight} />
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-surface-border/50">
                        <span className="text-[10px] text-gray-500">
                          {(ruleCountByPool[pool.name] ?? 0) === 0 ? "No rules" : `${ruleCountByPool[pool.name]} rule${ruleCountByPool[pool.name] === 1 ? "" : "s"}`}
                        </span>
                        <Layers size={11} className="text-gray-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Admission Rules ── */}
            {admissionRules.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-white">Admission Rules</h2>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400">{admissionRules.length}</span>
                  <span className="text-[10px] text-gray-500">Controls which searches are admitted to run</span>
                </div>
                <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border">
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap w-12">Order</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Rule Name</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Predicate / Condition</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Action</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admissionRules.map((rule) => (
                        <tr key={rule.name} className={clsx("border-b border-surface-border/50 hover:bg-surface-hover transition-colors", rule.disabled && "opacity-50")}>
                          <td className="px-3 py-2"><span className="text-xs font-mono text-gray-500">{rule.order}</span></td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-mono text-gray-300 truncate block" title={rule.name}>{rule.name}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-mono text-gray-400 truncate block" title={rule.predicate}>{rule.predicate || "—"}</span>
                          </td>
                          <td className="px-3 py-2">
                            {rule.action ? (
                              <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium",
                                /reject|block/i.test(rule.action) ? "bg-red-500/15 text-red-400 border border-red-500/25"
                                : /throttle/i.test(rule.action) ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                : "bg-gray-500/15 text-gray-400 border border-gray-500/25"
                              )}>
                                {rule.action}
                              </span>
                            ) : <span className="text-gray-600 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {rule.disabled
                              ? <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/15 text-gray-400 border border-gray-500/30">Disabled</span>
                              : <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Enabled</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Placement Rules ── */}
            {rules.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-white">Workload Placement Rules</h2>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-surface border border-surface-border text-gray-400">{rules.length}</span>
                </div>
                <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border">
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap w-12">Order</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Rule Name</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Predicate</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Pool</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => {
                        const poolCategory = poolCategoryMap[rule.workload_pool] ?? "misc";
                        return (
                          <tr key={rule.name} className={clsx("border-b border-surface-border/50 hover:bg-surface-hover transition-colors", rule.disabled && "opacity-50")}>
                            <td className="px-3 py-2"><span className="text-xs font-mono text-gray-500">{rule.order}</span></td>
                            <td className="px-3 py-2">
                              <span className="text-xs font-mono text-gray-300 truncate block" title={rule.name}>{rule.name}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs font-mono text-gray-400 truncate block" title={rule.predicate}>{rule.predicate || "—"}</span>
                            </td>
                            <td className="px-3 py-2">
                              {rule.workload_pool
                                ? <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium font-mono", poolPillClass(poolCategory))}>{rule.workload_pool}</span>
                                : <span className="text-gray-600 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {rule.disabled
                                ? <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/15 text-gray-400 border border-gray-500/30">Disabled</span>
                                : <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Enabled</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
        {/* ── Admission Rules (SPL-based) ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-violet-400 shrink-0" />
            <h2 className="text-sm font-semibold text-white">Admission Rules Configured</h2>
          </div>

          <button
            onClick={() => setShowAdmDrilldown((v) => !v)}
            className={clsx(
              "w-full rounded-xl border bg-surface-raised p-5 flex items-center gap-5 hover:bg-surface-hover transition-colors text-left",
              showAdmDrilldown ? "border-violet-500/40" : "border-surface-border"
            )}
            disabled={admCountLoading}
          >
            <div className="flex flex-col items-center justify-center w-24 shrink-0">
              {admCountLoading ? (
                <Loader2 size={24} className="animate-spin text-violet-400" />
              ) : admCountError ? (
                <span className="text-xs text-red-400 text-center">Error</span>
              ) : (
                <span className="text-4xl font-bold tabular-nums text-violet-400">
                  {admCount ?? "—"}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-200">Admission rules active on this stack</span>
              <span className="text-xs text-gray-500">
                via <span className="font-mono">workloads/status</span> · click to {showAdmDrilldown ? "collapse" : "expand"} detail
              </span>
              {admCountError && <span className="text-xs text-red-400 mt-1">{admCountError}</span>}
            </div>
            <div className="ml-auto shrink-0">
              {showAdmDrilldown ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
            </div>
          </button>

          {showAdmDrilldown && (
            <div className="mt-3 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
              {admDetailsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={16} className="animate-spin text-brand-400" />
                </div>
              ) : admDetailsError ? (
                <div className="p-5 text-xs text-red-400">{admDetailsError}</div>
              ) : admDetails.length === 0 ? (
                <div className="p-5 text-xs text-gray-500 text-center">No admission rules found.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border">
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Title</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Predicate</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">Action</th>
                        <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">User Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admDetails.map((row, i) => {
                        const action: string = (row as any)["search-filter-rules.AllTime.action"] ?? "";
                        return (
                          <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                            <td className="px-3 py-2">
                              <span className="text-xs font-mono text-gray-300">{(row as any).title || "—"}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs font-mono text-emerald-400 truncate block" title={(row as any)["search-filter-rules.AllTime.predicate"]}>
                                {(row as any)["search-filter-rules.AllTime.predicate"] || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {action ? (
                                <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  /reject|block/i.test(action) ? "bg-red-500/15 text-red-400 border border-red-500/25"
                                  : /throttle/i.test(action) ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                                )}>
                                  {action}
                                </span>
                              ) : <span className="text-gray-600 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-gray-400 truncate block" title={(row as any)["search-filter-rules.AllTime.user_message"]}>
                                {(row as any)["search-filter-rules.AllTime.user_message"] || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── WLM Live Activity ── */}
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-orange-400 shrink-0" />
              <h2 className="text-sm font-semibold text-white">Searches Filtered by WLM</h2>
              <span className="text-[10px] text-gray-500">from <span className="font-mono text-gray-400">index=_internal sourcetype=wlm_*</span></span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={wlmEarliest}
                onChange={(e) => {
                  setWlmEarliest(e.target.value);
                  setShowWlmDrilldown(false);
                }}
                className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stat card — clickable drilldown */}
          <button
            onClick={() => setShowWlmDrilldown((v) => !v)}
            className={clsx(
              "w-full rounded-xl border bg-surface-raised p-5 flex items-center gap-5 hover:bg-surface-hover transition-colors text-left",
              showWlmDrilldown ? "border-orange-500/40" : "border-surface-border"
            )}
            disabled={wlmCountLoading}
          >
            <div className="flex flex-col items-center justify-center w-24 shrink-0">
              {wlmCountLoading ? (
                <Loader2 size={24} className="animate-spin text-orange-400" />
              ) : wlmCountError ? (
                <span className="text-xs text-red-400 text-center">Error</span>
              ) : (
                <span className="text-4xl font-bold tabular-nums" style={{ color: (wlmCount ?? 0) > 0 ? "#f97316" : "#6b7280" }}>
                  {wlmCount ?? "—"}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-200">Distinct searches filtered by WLM</span>
              <span className="text-xs text-gray-500">
                {TIME_OPTIONS.find((o) => o.value === wlmEarliest)?.label ?? wlmEarliest} · click to {showWlmDrilldown ? "collapse" : "expand"} detail
              </span>
              {wlmCountError && <span className="text-xs text-red-400 mt-1">{wlmCountError}</span>}
            </div>
            <div className="ml-auto shrink-0">
              {showWlmDrilldown ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
            </div>
          </button>

          {/* Drilldown detail table */}
          {showWlmDrilldown && (
            <div className="mt-3 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
              {wlmDetailsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={16} className="animate-spin text-brand-400" />
                </div>
              ) : wlmDetailsError ? (
                <div className="p-5 text-xs text-red-400">{wlmDetailsError}</div>
              ) : wlmDetails.length === 0 ? (
                <div className="p-5 text-xs text-gray-500 text-center">No results — no searches were filtered by WLM in this time window.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border">
                        {["Search Name", "App", "User", "Search Type", "Prefilter Rule", "Action", "Count"].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {wlmDetails.map((row, i) => (
                        <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                          <td className="px-3 py-2">
                            <span className="text-xs font-mono text-gray-200 truncate block" title={(row as any).search_name}>{(row as any).search_name || "—"}</span>
                          </td>
                          <td className="px-3 py-2"><span className="text-xs text-gray-400">{(row as any).app || "—"}</span></td>
                          <td className="px-3 py-2"><span className="text-xs text-gray-400">{(row as any).user || "—"}</span></td>
                          <td className="px-3 py-2">
                            <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium",
                              (row as any).search_type === "scheduled" ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                              : "bg-gray-500/15 text-gray-400 border border-gray-500/25"
                            )}>
                              {(row as any).search_type || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-mono text-violet-400 truncate block" title={(row as any).prefilter_rule}>{(row as any).prefilter_rule || "—"}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/25">
                              {(row as any).prefilter_action || "filter"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right"><span className="text-xs font-mono text-gray-300">{(row as any).count}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>


      </div>
    </div>
  );
}
