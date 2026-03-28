import { useState } from "react";
import { SkipForward, Play, Loader2, RefreshCw } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import type { SplunkResult } from "../types/splunk";

const DEFAULT_SPL = `index=_internal sourcetype=scheduler status=skipped
| stats count as skip_count latest(_time) as last_skipped by savedsearch_name app user reason
| sort -skip_count
| eval last_skipped=strftime(last_skipped, "%Y-%m-%d %H:%M:%S")
| rename savedsearch_name AS "Search Name", app AS "App", user AS "User", skip_count AS "Skip Count", last_skipped AS "Last Skipped", reason AS "Reason"`;

export function SkippedSearchesPage() {
  const [spl, setSpl] = useState(DEFAULT_SPL);
  const [results, setResults] = useState<SplunkResult[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSpl, setEditSpl] = useState(false);
  const [filter, setFilter] = useState("");

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(spl, "-24h", "now");
      setResults(res.results || []);
      if (res.results?.length > 0) {
        setColumns(Object.keys(res.results[0]).filter((k) => !k.startsWith("_")));
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

  const totalSkips = results.reduce((sum, r) => sum + (Number(r["Skip Count"]) || 0), 0);

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Skipped Searches" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <SkipForward size={20} className="text-amber-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Skipped Scheduled Searches</h2>
            <p className="text-[10px] text-gray-500">Searches that were skipped by the scheduler (from _internal, last 24h)</p>
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
              <textarea value={spl} onChange={(e) => setSpl(e.target.value)} rows={6}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-y" spellCheck={false} />
              <button onClick={() => { runSearch(); setEditSpl(false); }}
                className="self-start rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors">Run</button>
            </div>
          ) : (
            <pre className="text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{spl}</pre>
          )}
        </div>

        {/* Summary + Run */}
        <div className="flex items-center gap-4 mb-4">
          <button onClick={runSearch} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </button>
          {results.length > 0 && (
            <>
              <span className="text-xs text-gray-400">{results.length} searches skipped</span>
              <span className="text-xs text-amber-400 font-semibold">{totalSkips.toLocaleString()} total skips</span>
            </>
          )}
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
            className="ml-auto rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500 w-52"
            placeholder="Filter..." />
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Results */}
        {filtered.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-380px)]">
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
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-xs font-mono text-gray-300 whitespace-nowrap" title={row[col]}>
                          {col === "Skip Count" ? (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-400">{row[col]}</span>
                          ) : col === "Reason" ? (
                            <span className="rounded px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-400">{row[col]}</span>
                          ) : row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && results.length === 0 && !error && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
            <SkipForward size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">Click "Run" to find skipped searches in the last 24 hours</p>
          </div>
        )}
      </div>
    </div>
  );
}
