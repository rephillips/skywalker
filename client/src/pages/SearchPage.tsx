import { useState, useCallback } from "react";
import { Search, Play, Loader2, Clock } from "lucide-react";
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

export function SearchPage() {
  const [spl, setSpl] = useState("search index=_internal | head 50");
  const [timePreset, setTimePreset] = useState(1);
  const [results, setResults] = useState<SplunkResult[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const runSearch = useCallback(async () => {
    if (!spl.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    const start = Date.now();
    const preset = TIME_PRESETS[timePreset];

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
                placeholder="search index=_internal | head 50"
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
          </p>
        </div>

        {/* Status bar */}
        {(results || error) && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {results && (
              <span>
                {results.length.toLocaleString()} result{results.length !== 1 && "s"}
              </span>
            )}
            {elapsed !== null && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {(elapsed / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {error && <ErrorAlert message={error} />}

        {/* Results table */}
        {results && results.length > 0 && (
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
