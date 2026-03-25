import { useState, useCallback, useMemo } from "react";
import { Search, Play, Loader2, Clock, BarChart3, Table2, LineChart as LineChartIcon, Terminal, ChevronDown } from "lucide-react";
import { LineChart, BarChart, AreaChart } from "@tremor/react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import type { SplunkResult } from "../types/splunk";
import { ErrorAlert } from "../components/common/ErrorAlert";

const TIME_PRESETS = [
  { label: "Last 15 min", earliest: "-15m", latest: "now" },
  { label: "Last 1 hour", earliest: "-1h", latest: "now" },
  { label: "Last 4 hours", earliest: "-4h", latest: "now" },
  { label: "Last 24 hours", earliest: "-24h", latest: "now" },
  { label: "Last 7 days", earliest: "-7d", latest: "now" },
  { label: "All time", earliest: "0", latest: "now" },
];

type ViewMode = "auto" | "chart" | "table";
type ChartType = "line" | "bar" | "area";

function detectChartQuery(spl: string): boolean {
  const lower = spl.toLowerCase();
  return /\|\s*(timechart|chart|tstats)\b/.test(lower);
}

function detectChartType(spl: string): ChartType {
  const lower = spl.toLowerCase();
  if (/\|\s*timechart\b/.test(lower)) return "line";
  if (/\|\s*chart\b/.test(lower)) return "bar";
  return "line";
}

const CHART_COLORS = ["indigo", "cyan", "emerald", "amber", "rose", "violet", "blue", "orange"];

export function SearchPage() {
  const [spl, setSpl] = useState("index=_internal | timechart span=1m count by host");
  const [timePreset, setTimePreset] = useState(1);
  const [results, setResults] = useState<SplunkResult[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("auto");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [showApiCall, setShowApiCall] = useState(false);
  const [lastSearchedSpl, setLastSearchedSpl] = useState("");

  const isChartQuery = useMemo(() => detectChartQuery(spl), [spl]);

  const showChart = viewMode === "chart" || (viewMode === "auto" && isChartQuery);
  const showTable = viewMode === "table" || (viewMode === "auto" && !isChartQuery) || viewMode === "auto";

  const { chartData, chartIndex, chartCategories } = useMemo(() => {
    if (!results || results.length === 0) {
      return { chartData: [], chartIndex: "_time", chartCategories: [] };
    }

    const allKeys = Object.keys(results[0]);
    const index = allKeys.includes("_time") ? "_time" : allKeys[0];
    const skip = new Set(["_time", "_span", "_spandays", index]);
    const categories = allKeys.filter((k) => !skip.has(k) && !k.startsWith("_"));

    const data = results.map((row) => {
      const point: Record<string, string | number> = {
        [index]: row[index],
      };
      categories.forEach((cat) => {
        point[cat] = Number(row[cat]) || 0;
      });
      return point;
    });

    return { chartData: data, chartIndex: index, chartCategories: categories };
  }, [results]);

  const runSearch = useCallback(async () => {
    if (!spl.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    const start = Date.now();
    const preset = TIME_PRESETS[timePreset];
    setChartType(detectChartType(spl));
    setLastSearchedSpl(spl);

    try {
      const response = await api.search(spl, preset.earliest, preset.latest);
      setResults(response.results);
      setElapsed(Date.now() - start);

      if (response.results.length > 0) {
        setColumns(
          Object.keys(response.results[0]).filter(
            (k) => !k.startsWith("_") || k === "_time" || k === "_raw"
          )
        );
      } else {
        setColumns([]);
      }

      setHistory((prev) => {
        const next = [spl, ...prev.filter((s) => s !== spl)];
        return next.slice(0, 20);
      });
    } catch (err) {
      setError((err as Error).message);
      setElapsed(Date.now() - start);
    } finally {
      setLoading(false);
    }
  }, [spl, timePreset]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Search" />

      <div className="flex flex-col gap-4 p-6">
        {/* Search bar */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-3 text-gray-500"
              />
              <textarea
                value={spl}
                onChange={(e) => setSpl(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                className="w-full rounded-lg border border-surface-border bg-surface pl-9 pr-3 py-2.5 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors resize-none"
                placeholder="index=_internal | timechart span=1m count by host"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={runSearch}
                disabled={loading || !spl.trim()}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Run
              </button>
              <select
                value={timePreset}
                onChange={(e) => setTimePreset(Number(e.target.value))}
                className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-brand-500"
              >
                {TIME_PRESETS.map((p, i) => (
                  <option key={i} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Press <kbd className="rounded border border-surface-border px-1 py-0.5 text-gray-400">Cmd+Enter</kbd> to run
            {isChartQuery && <span className="ml-2 text-brand-400">— chart query detected</span>}
          </p>
        </div>

        {/* REST API call */}
        {lastSearchedSpl && (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <button
              onClick={() => setShowApiCall(!showApiCall)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
            >
              <Terminal size={12} />
              <span className="font-medium">REST API Call</span>
              <ChevronDown size={12} className={clsx("ml-auto transition-transform", showApiCall && "rotate-180")} />
            </button>
            {showApiCall && (
              <div className="border-t border-surface-border px-4 py-3 space-y-2">
                <div>
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">1. Create Search Job</span>
                  <pre className="mt-1 text-xs font-mono text-emerald-400/90 whitespace-pre-wrap break-all leading-relaxed">
{`curl -k -X POST https://<splunk-host>:8089/services/search/v2/jobs \\
  -H "Authorization: Bearer <token>" \\
  -d search="${encodeURIComponent(lastSearchedSpl)}" \\
  -d earliest_time="${TIME_PRESETS[timePreset].earliest}" \\
  -d latest_time="${TIME_PRESETS[timePreset].latest}" \\
  -d output_mode=json`}
                  </pre>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">2. Get Results</span>
                  <pre className="mt-1 text-xs font-mono text-blue-400/80 whitespace-pre-wrap break-all leading-relaxed">
{`curl -k https://<splunk-host>:8089/services/search/v2/jobs/<sid>/results \\
  -H "Authorization: Bearer <token>" \\
  -d output_mode=json&count=1000`}
                  </pre>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">SkyWalker Proxy</span>
                  <pre className="mt-1 text-xs font-mono text-gray-400 whitespace-pre-wrap break-all leading-relaxed">
{`POST /api/search
Content-Type: application/json

${JSON.stringify({ spl: lastSearchedSpl, earliest: TIME_PRESETS[timePreset].earliest, latest: TIME_PRESETS[timePreset].latest }, null, 2)}`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status bar + view toggle */}
        {results && results.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>
                {results.length.toLocaleString()} result{results.length !== 1 && "s"}
              </span>
              {elapsed !== null && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {(elapsed / 1000).toFixed(2)}s
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Chart type selector */}
              {showChart && (
                <div className="flex items-center gap-1 mr-2 border-r border-surface-border pr-2">
                  {(["line", "area", "bar"] as ChartType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartType(t)}
                      className={clsx(
                        "rounded-md p-1.5 text-xs transition-colors",
                        chartType === t
                          ? "bg-brand-500/15 text-brand-400"
                          : "text-gray-500 hover:text-gray-300"
                      )}
                      title={t.charAt(0).toUpperCase() + t.slice(1) + " chart"}
                    >
                      {t === "bar" ? <BarChart3 size={14} /> : <LineChartIcon size={14} />}
                    </button>
                  ))}
                </div>
              )}
              {/* View mode */}
              {(["auto", "chart", "table"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === mode
                      ? "bg-brand-500/15 text-brand-400"
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  {mode === "auto" ? "Auto" : mode === "chart" ? "Chart" : "Table"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <ErrorAlert message={error} />}

        {/* Chart visualization */}
        {results && results.length > 0 && showChart && chartCategories.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="h-80">
              {chartType === "line" && (
                <LineChart
                  data={chartData}
                  index={chartIndex}
                  categories={chartCategories}
                  colors={CHART_COLORS.slice(0, chartCategories.length)}
                  yAxisWidth={56}
                  showAnimation
                  className="h-full"
                />
              )}
              {chartType === "area" && (
                <AreaChart
                  data={chartData}
                  index={chartIndex}
                  categories={chartCategories}
                  colors={CHART_COLORS.slice(0, chartCategories.length)}
                  yAxisWidth={56}
                  showAnimation
                  className="h-full"
                />
              )}
              {chartType === "bar" && (
                <BarChart
                  data={chartData}
                  index={chartIndex}
                  categories={chartCategories}
                  colors={CHART_COLORS.slice(0, chartCategories.length)}
                  yAxisWidth={56}
                  showAnimation
                  className="h-full"
                />
              )}
            </div>
          </div>
        )}

        {/* Results table */}
        {results && results.length > 0 && showTable && (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-340px)]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface-raised z-10">
                  <tr className="border-b border-surface-border">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 text-gray-300 max-w-md truncate font-mono text-xs"
                        >
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results && results.length === 0 && !error && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center text-sm text-gray-500">
            No results found.
          </div>
        )}

        {/* Search history */}
        {history.length > 0 && !loading && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Recent Searches
            </h3>
            <div className="flex flex-col gap-1">
              {history.map((query, i) => (
                <button
                  key={i}
                  onClick={() => setSpl(query)}
                  className="text-left text-xs font-mono text-gray-400 hover:text-gray-200 truncate py-1 px-2 rounded hover:bg-surface-hover transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
