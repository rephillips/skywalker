import { useState, useEffect, useCallback, useRef } from "react";
import { Network, RefreshCw, Loader2, SearchCode } from "lucide-react";
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
  const [timeRange, setTimeRange] = useState("-4h");
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

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
                <div className="absolute right-0 bottom-8 z-50 w-96 rounded-xl border border-surface-border bg-surface-raised shadow-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">SPL Query</span>
                    <CopyButton text={spl} />
                  </div>
                  <pre className="text-[10px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all max-h-48 overflow-auto">{spl}</pre>
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
