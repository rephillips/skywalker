import { useState, useEffect, useCallback } from "react";
import { Network, RefreshCw, Loader2 } from "lucide-react";
import { LineChart } from "@tremor/react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";

const DEFAULT_SPL = `index=_internal sourcetype=splunkd group=searchscheduler host IN (sh*)
| eval state=if(delegated>0, "captain", "non-captain")
| search state="captain"
| timechart span=1m distinct_count(state) by host`;

const NEON_COLORS = ["emerald", "cyan", "fuchsia", "amber", "violet", "rose", "teal", "indigo"];

export function SHCPage() {
  const [spl, setSpl] = useState(DEFAULT_SPL);
  const [chartData, setChartData] = useState<Record<string, string | number>[]>([]);
  const [chartCategories, setChartCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editSpl, setEditSpl] = useState(false);
  const [timeRange, setTimeRange] = useState("-4h");
  const [showSpl, setShowSpl] = useState(false);

  const runSearch = useCallback(async (searchSpl?: string, range?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(searchSpl || spl, range || timeRange, "now");
      if (res.results?.length > 0) {
        const keys = Object.keys(res.results[0]).filter((k) => k !== "_time" && !k.startsWith("_"));
        setChartCategories(keys);
        setChartData(res.results.map((row) => {
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
  }, [spl, timeRange]);

  // Auto-run on mount
  useEffect(() => { runSearch(); }, []);

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Search Head Clustering" />
      <div className="p-6">
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
              <select value={timeRange} onChange={(e) => { setTimeRange(e.target.value); runSearch(spl, e.target.value); }}
                className="rounded border border-surface-border bg-surface px-2 py-1 text-[10px] text-gray-300 outline-none">
                <option value="-1h">1h</option>
                <option value="-4h">4h</option>
                <option value="-24h">24h</option>
                <option value="-7d">7d</option>
              </select>
            </div>
            <button onClick={() => setShowSpl(!showSpl)} className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors">
              {showSpl ? "Hide SPL" : "View SPL"}
            </button>
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

        {/* SPL (collapsed by default) */}
        {showSpl && (
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
                <textarea value={spl} onChange={(e) => setSpl(e.target.value)} rows={6}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-y" spellCheck={false} />
                <button onClick={() => { runSearch(); setEditSpl(false); setShowSpl(false); }}
                  className="self-start rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors">Run</button>
              </div>
            ) : (
              <pre className="text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{spl}</pre>
            )}
          </div>
        )}

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Timeline Chart */}
        {loading && chartData.length === 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
            <Loader2 size={24} className="mx-auto mb-2 text-brand-400 animate-spin" />
            <p className="text-xs text-gray-500">Loading captain timeline...</p>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Captain Role Over Time</h3>
            <div style={{ height: 350 }}>
              <LineChart
                data={chartData}
                index="_time"
                categories={chartCategories}
                colors={NEON_COLORS.slice(0, chartCategories.length)}
                yAxisWidth={32}
                showAnimation
                showLegend
                style={{ height: 350, width: "100%" }}
              />
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
