import { useState } from "react";
import { Snail, Play, Loader2 } from "lucide-react";
import { LineChart } from "@tremor/react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import type { SplunkResult } from "../types/splunk";

const DEFAULT_SPL = `index=_audit sourcetype=audittrail action=search info=completed
| eval run_time=round(total_run_time, 2)
| where run_time > 60
| stats count as executions avg(run_time) as avg_runtime max(run_time) as max_runtime latest(_time) as last_run by savedsearch_name user app
| eval avg_runtime=round(avg_runtime, 1), max_runtime=round(max_runtime, 1), last_run=strftime(last_run, "%Y-%m-%d %H:%M:%S")
| sort -avg_runtime
| rename savedsearch_name AS "Search Name", user AS "User", app AS "App", executions AS "Runs", avg_runtime AS "Avg Runtime (s)", max_runtime AS "Max Runtime (s)", last_run AS "Last Run"`;

const TIMECHART_SPL = `index=_audit sourcetype=audittrail action=search info=completed
| eval run_time=round(total_run_time, 2)
| where run_time > THRESHOLD
| timechart span=10m avg(run_time) as "Avg Runtime" max(run_time) as "Max Runtime" count as "Search Count"`;

const NEON_COLORS = ["emerald", "cyan", "fuchsia"];

export function SlowSearchesPage() {
  const [spl, setSpl] = useState(DEFAULT_SPL);
  const [results, setResults] = useState<SplunkResult[]>([]);
  const [chartData, setChartData] = useState<Record<string, string | number>[]>([]);
  const [chartCategories, setChartCategories] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSpl, setEditSpl] = useState(false);
  const [filter, setFilter] = useState("");
  const [threshold, setThreshold] = useState(60);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      // Run table query
      const adjustedSpl = spl.replace(/where run_time > \d+/, `where run_time > ${threshold}`);
      const res = await api.search(adjustedSpl, "-24h", "now");
      setResults(res.results || []);
      if (res.results?.length > 0) {
        setColumns(Object.keys(res.results[0]).filter((k) => !k.startsWith("_")));
      }

      // Run timechart query
      const tcSpl = TIMECHART_SPL.replace("THRESHOLD", String(threshold));
      const tcRes = await api.search(tcSpl, "-24h", "now");
      if (tcRes.results?.length > 0) {
        const keys = Object.keys(tcRes.results[0]).filter((k) => k !== "_time" && !k.startsWith("_"));
        setChartCategories(keys);
        setChartData(tcRes.results.map((row) => {
          const point: Record<string, string | number> = {
            _time: new Date(row._time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
  }

  const lowerFilter = filter.toLowerCase();
  const filtered = results.filter((r) => {
    if (!filter) return true;
    return Object.values(r).some((v) => String(v).toLowerCase().includes(lowerFilter));
  });

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Slow Searches" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Snail size={20} className="text-red-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Slow Searches</h2>
            <p className="text-[10px] text-gray-500">Searches exceeding the runtime threshold (from _audit, last 24h)</p>
          </div>
        </div>

        {/* SPL */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">SPL Query</span>
            <div className="flex items-center gap-2">
              <CopyButton text={spl} />
              <button onClick={() => setEditSpl(!editSpl)} className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors">
                {editSpl ? "Cancel" : "Edit"}
              </button>
            </div>
          </div>
          {editSpl ? (
            <div className="flex flex-col gap-2">
              <textarea value={spl} onChange={(e) => setSpl(e.target.value)} rows={8}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-y" spellCheck={false} />
              <button onClick={() => { runSearch(); setEditSpl(false); }}
                className="self-start rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors">Run</button>
            </div>
          ) : (
            <pre className="text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{spl}</pre>
          )}
        </div>

        {/* Threshold + Run */}
        <div className="flex items-center gap-4 mb-4">
          <button onClick={runSearch} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">Threshold:</span>
            <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} min={1}
              className="w-16 rounded border border-surface-border bg-surface px-2 py-1 text-[10px] text-gray-300 outline-none" />
            <span className="text-[10px] text-gray-600">seconds</span>
          </div>
          {results.length > 0 && (
            <span className="text-xs text-gray-400">{results.length} slow searches found</span>
          )}
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
            className="ml-auto rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500 w-52"
            placeholder="Filter..." />
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Timechart */}
        {chartData.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mb-4">
            <h3 className="text-xs font-semibold text-white mb-3">Slow Search Activity Over Time</h3>
            <div style={{ height: 250 }}>
              <LineChart
                data={chartData}
                index="_time"
                categories={chartCategories}
                colors={NEON_COLORS.slice(0, chartCategories.length)}
                yAxisWidth={48}
                showAnimation
                showLegend
                style={{ height: 250, width: "100%" }}
              />
            </div>
          </div>
        )}

        {/* Results table */}
        {filtered.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-580px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised z-10">
                  <tr className="border-b border-surface-border">
                    {columns.map((col) => (
                      <th key={col} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                      {columns.map((col) => {
                        const val = row[col] || "";
                        const isRuntime = col.includes("Runtime");
                        const numVal = Number(val);
                        return (
                          <td key={col} className="px-3 py-2 text-xs font-mono text-gray-300 whitespace-nowrap" title={val}>
                            {isRuntime ? (
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                numVal > 300 ? "bg-red-500/15 text-red-400"
                                : numVal > 120 ? "bg-amber-500/15 text-amber-400"
                                : "bg-yellow-500/15 text-yellow-400"
                              }`}>
                                {val}s
                              </span>
                            ) : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && results.length === 0 && !error && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
            <Snail size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">Click "Run" to find searches exceeding {threshold}s runtime</p>
          </div>
        )}
      </div>
    </div>
  );
}
