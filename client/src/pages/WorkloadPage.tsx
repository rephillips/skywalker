import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Layers, ToggleLeft } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import clsx from "clsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkloadConfig {
  enabled: boolean;
}

interface WorkloadPool {
  name: string;
  cpu_weight: number;
  mem_weight: number;
  category: string;
  default_category_pool: boolean;
}

interface WorkloadRule {
  name: string;
  predicate: string;
  workload_pool: string;
  order: number;
  disabled: boolean;
}

interface AdmissionRule {
  name: string;
  predicate: string;
  action: string;
  order: number;
  disabled: boolean;
}

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
    case "search":
      return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
    case "ingest":
      return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
    default:
      return "bg-gray-500/15 text-gray-400 border border-gray-500/30";
  }
}

function poolPillClass(category: string): string {
  switch (category?.toLowerCase()) {
    case "search":
      return "bg-blue-500/10 text-blue-300 border border-blue-500/20";
    case "ingest":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    default:
      return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeightBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-gray-400 w-8 text-right shrink-0">{value}</span>
    </div>
  );
}

function PoolCard({
  pool,
  ruleCount,
}: {
  pool: WorkloadPool;
  ruleCount: number;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold font-mono text-white truncate" title={pool.name}>
          {pool.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {pool.default_category_pool && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Default
            </span>
          )}
          <span
            className={clsx(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              categoryBadgeClass(pool.category)
            )}
          >
            {pool.category || "misc"}
          </span>
        </div>
      </div>

      {/* Weight bars */}
      <div className="flex flex-col gap-1.5">
        <WeightBar label="CPU" value={pool.cpu_weight} />
        <WeightBar label="Mem" value={pool.mem_weight} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-surface-border/50">
        <span className="text-[10px] text-gray-500">
          {ruleCount === 0
            ? "No rules"
            : ruleCount === 1
            ? "1 rule"
            : `${ruleCount} rules`}
        </span>
        <Layers size={11} className="text-gray-600" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkloadPage() {
  const [config, setConfig] = useState<WorkloadConfig | null>(null);
  const [pools, setPools] = useState<WorkloadPool[]>([]);
  const [rules, setRules] = useState<WorkloadRule[]>([]);
  const [admissionRules, setAdmissionRules] = useState<AdmissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawDebug, setRawDebug] = useState<Record<string, any>>({});
  const [showRaw, setShowRaw] = useState(false);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, poolsRes, rulesRes, admissionRes] = await Promise.all([
        api.proxy("workloads/config?count=0"),
        api.proxy("workloads/pools?count=0"),
        api.proxy("workloads/rules?count=0"),
        api.proxy("workloads/admission-rules?count=0"),
      ]);

      setRawDebug({ rules: rulesRes, admissionRules: admissionRes });

      if (cfgRes.status === "error") throw new Error(cfgRes.message || "Failed to fetch workload config");
      if (poolsRes.status === "error") throw new Error(poolsRes.message || "Failed to fetch workload pools");
      if (rulesRes.status === "error") throw new Error(rulesRes.message || "Failed to fetch workload rules");
      // admission-rules failure is non-fatal — some instances may not have it

      // Config
      const cfgEntry = cfgRes.data?.entry?.[0]?.content ?? {};
      setConfig({ enabled: parseBool(cfgEntry.enabled) });

      // Pools
      const rawPools: WorkloadPool[] = (poolsRes.data?.entry ?? []).map((e: any) => {
        const c = e.content ?? {};
        return {
          name: e.name ?? "",
          cpu_weight: parseNum(c.cpu_weight),
          mem_weight: parseNum(c.mem_weight),
          category: c.category ?? "misc",
          default_category_pool: parseBool(c.default_category_pool),
        };
      });
      setPools(rawPools);

      // Placement rules — sorted by order ascending
      const rawRules: WorkloadRule[] = (rulesRes.data?.entry ?? [])
        .map((e: any) => {
          const c = e.content ?? {};
          return {
            name: e.name ?? "",
            predicate: c.predicate ?? "",
            workload_pool: c.workload_pool ?? "",
            order: parseNum(c.order, 0),
            disabled: parseBool(c.disabled),
          };
        })
        .sort((a: WorkloadRule, b: WorkloadRule) => a.order - b.order);
      setRules(rawRules);

      // Admission rules
      if (admissionRes.status === "ok") {
        const rawAdmission: AdmissionRule[] = (admissionRes.data?.entry ?? [])
          .map((e: any) => {
            const c = e.content ?? {};
            return {
              name: e.name ?? "",
              predicate: c.predicate ?? "",
              action: c.action ?? "",
              order: parseNum(c.order, 0),
              disabled: parseBool(c.disabled),
            };
          })
          .sort((a: AdmissionRule, b: AdmissionRule) => a.order - b.order);
        setAdmissionRules(rawAdmission);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  // Derived
  const activeRules = rules.filter((r) => !r.disabled);
  const activeAdmissionRules = admissionRules.filter((r) => !r.disabled);
  const notConfigured = !loading && !error && pools.length === 0 && rules.length === 0 && admissionRules.length === 0;

  // Build pool-name → category map for rule table pills
  const poolCategoryMap = Object.fromEntries(pools.map((p) => [p.name, p.category]));

  // Rule count per pool
  const ruleCountByPool: Record<string, number> = {};
  for (const r of rules) {
    ruleCountByPool[r.workload_pool] = (ruleCountByPool[r.workload_pool] ?? 0) + 1;
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Workload Management" />

      <div className="p-6 flex flex-col gap-6 max-w-6xl">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-brand-400" />
          </div>
        )}

        {/* Error */}
        {!loading && error && <ErrorAlert message={error} />}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* ── Status banner ── */}
            <div className="rounded-xl border border-surface-border bg-surface-raised px-5 py-3 flex items-center gap-4 flex-wrap">
              {/* Enabled / Disabled */}
              <div className="flex items-center gap-2">
                {config?.enabled ? (
                  <>
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Enabled
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex h-2 w-2 rounded-full bg-gray-500 shrink-0" />
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                      Disabled
                    </span>
                  </>
                )}
              </div>

              <div className="h-4 w-px bg-surface-border shrink-0" />

              {/* Counts */}
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
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="font-semibold text-emerald-400">{activeRules.length + activeAdmissionRules.length}</span>
                <span>active</span>
              </div>

              {/* Refresh */}
              <div className="ml-auto">
                <button
                  onClick={fetchAll}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
              </div>
            </div>

            {/* ── Raw response inspector ── */}
            <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
              >
                <span className="font-medium">Raw API Response (workloads/rules + workloads/admission-rules)</span>
                <span className="text-[10px] text-gray-600">{showRaw ? "▲ hide" : "▼ show"}</span>
              </button>
              {showRaw && (
                <pre className="px-4 pb-4 text-[10px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all overflow-auto max-h-96 border-t border-surface-border">
                  {JSON.stringify(rawDebug, null, 2)}
                </pre>
              )}
            </div>

            {/* ── Not configured ── */}
            {notConfigured && (
              <div className="rounded-xl border border-surface-border bg-surface-raised p-10 flex flex-col items-center gap-3 text-center">
                <ToggleLeft size={32} className="text-gray-600" />
                <p className="text-sm font-semibold text-gray-400">
                  Workload Management is not configured on this instance
                </p>
                <p className="text-xs text-gray-600 max-w-sm">
                  No pools or rules were returned. Workload Management may be disabled or not licensed for this Splunk deployment.
                </p>
              </div>
            )}

            {/* ── Pools section ── */}
            {pools.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3">Workload Pools</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pools.map((pool) => (
                    <PoolCard
                      key={pool.name}
                      pool={pool}
                      ruleCount={ruleCountByPool[pool.name] ?? 0}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Rules section ── */}
            {rules.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-white">Workload Rules</h2>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-surface border border-surface-border text-gray-400">
                    {rules.length}
                  </span>
                </div>

                <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-border">
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap w-12">
                            Order
                          </th>
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                            Rule Name
                          </th>
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                            Predicate
                          </th>
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                            Pool
                          </th>
                          <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((rule) => {
                          const poolCategory = poolCategoryMap[rule.workload_pool] ?? "misc";
                          return (
                            <tr
                              key={rule.name}
                              className={clsx(
                                "border-b border-surface-border/50 hover:bg-surface-hover transition-colors",
                                rule.disabled && "opacity-50"
                              )}
                            >
                              {/* Order */}
                              <td className="px-3 py-2">
                                <span className="text-xs font-mono text-gray-500">{rule.order}</span>
                              </td>

                              {/* Rule name */}
                              <td className="px-3 py-2 max-w-[200px]">
                                <span
                                  className="text-xs font-mono text-gray-300 truncate block"
                                  title={rule.name}
                                >
                                  {rule.name}
                                </span>
                              </td>

                              {/* Predicate */}
                              <td className="px-3 py-2 max-w-[300px]">
                                <span
                                  className="text-xs font-mono text-gray-400 truncate block"
                                  title={rule.predicate}
                                >
                                  {rule.predicate || <span className="text-gray-600 italic">—</span>}
                                </span>
                              </td>

                              {/* Pool pill */}
                              <td className="px-3 py-2">
                                {rule.workload_pool ? (
                                  <span
                                    className={clsx(
                                      "rounded px-1.5 py-0.5 text-[10px] font-medium font-mono",
                                      poolPillClass(poolCategory)
                                    )}
                                  >
                                    {rule.workload_pool}
                                  </span>
                                ) : (
                                  <span className="text-gray-600 text-xs">—</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="px-3 py-2">
                                {rule.disabled ? (
                                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/15 text-gray-400 border border-gray-500/30">
                                    Disabled
                                  </span>
                                ) : (
                                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Enabled
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ── Admission Rules section ── */}
            {admissionRules.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-white">Admission Rules</h2>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400">
                    {admissionRules.length}
                  </span>
                  <span className="text-[10px] text-gray-500">Controls which searches are admitted to run</span>
                </div>

                <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                  <div className="overflow-auto">
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
                          <tr
                            key={rule.name}
                            className={clsx(
                              "border-b border-surface-border/50 hover:bg-surface-hover transition-colors",
                              rule.disabled && "opacity-50"
                            )}
                          >
                            <td className="px-3 py-2">
                              <span className="text-xs font-mono text-gray-500">{rule.order}</span>
                            </td>
                            <td className="px-3 py-2 max-w-[200px]">
                              <span className="text-xs font-mono text-gray-300 truncate block" title={rule.name}>
                                {rule.name}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[320px]">
                              <span className="text-xs font-mono text-gray-400 truncate block" title={rule.predicate}>
                                {rule.predicate || <span className="text-gray-600 italic">—</span>}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {rule.action ? (
                                <span className={clsx(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  rule.action.toLowerCase().includes("reject") || rule.action.toLowerCase().includes("block")
                                    ? "bg-red-500/15 text-red-400 border border-red-500/25"
                                    : rule.action.toLowerCase().includes("throttle")
                                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                    : "bg-gray-500/15 text-gray-400 border border-gray-500/25"
                                )}>
                                  {rule.action}
                                </span>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {rule.disabled ? (
                                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-500/15 text-gray-400 border border-gray-500/30">Disabled</span>
                              ) : (
                                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Enabled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
