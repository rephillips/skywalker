import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Layers, ToggleLeft } from "lucide-react";
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkloadPage() {
  const [rawStatus, setRawStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

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

  // ── Parse data from the status response ──────────────────────────────────
  const content = rawStatus?.data?.entry?.[0]?.content ?? null;

  // enabled flag
  const enabled: boolean = content ? parseBool(content.enabled ?? content.wlm_enabled) : false;

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

  const notConfigured = !loading && !error && content !== null && pools.length === 0 && rules.length === 0 && admissionRules.length === 0;
  const noData = !loading && !error && content === null;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Workload Management" />

      <div className="p-6 flex flex-col gap-6 max-w-6xl">
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
                <span className="font-semibold text-violet-400">{admissionRules.length}</span>
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
                          <td className="px-3 py-2 max-w-[200px]">
                            <span className="text-xs font-mono text-gray-300 truncate block" title={rule.name}>{rule.name}</span>
                          </td>
                          <td className="px-3 py-2 max-w-[320px]">
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
                            <td className="px-3 py-2 max-w-[200px]">
                              <span className="text-xs font-mono text-gray-300 truncate block" title={rule.name}>{rule.name}</span>
                            </td>
                            <td className="px-3 py-2 max-w-[300px]">
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
      </div>
    </div>
  );
}
