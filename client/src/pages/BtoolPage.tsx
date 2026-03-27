import { useState } from "react";
import { Terminal, Play, Loader2, AlertTriangle, Filter } from "lucide-react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import type { SplunkResult } from "../types/splunk";

const BTOOL_COMMANDS = [
  { label: "Check All", spl: "| btoolcheck", description: "Run btool check across all apps and conf files" },
  { label: "Check by App", spl: '| btoolcheck app=', description: "Filter results by app name" },
  { label: "Check by Conf", spl: '| btoolcheck conf=', description: "Filter results by conf file type" },
  { label: "Check App + Conf", spl: '| btoolcheck app= conf=', description: "Filter by both app and conf file" },
];

const MESSAGE_COLORS: Record<string, string> = {
  "Invalid key": "text-red-400 bg-red-500/10",
  "Possible typo": "text-amber-400 bg-amber-500/10",
  "No spec file": "text-blue-400 bg-blue-500/10",
};

export function BtoolPage() {
  const [spl, setSpl] = useState("| btoolcheck");
  const [results, setResults] = useState<SplunkResult[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  async function runBtool() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(spl);
      const rows = res.results || [];
      setResults(rows);
      if (rows.length > 0) {
        setColumns(Object.keys(rows[0]).filter((k) => !k.startsWith("_") || k === "_raw"));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const lowerFilter = filterText.toLowerCase();
  const filtered = results.filter((r) => {
    if (filterType !== "all" && r.message_type !== filterType) return false;
    if (!filterText) return true;
    return Object.values(r).some((v) => String(v).toLowerCase().includes(lowerFilter));
  });

  // Count by message type
  const typeCounts: Record<string, number> = {};
  results.forEach((r) => {
    const t = r.message_type || "Other";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  // Count by app
  const appCounts: Record<string, number> = {};
  results.forEach((r) => {
    const a = r.app_name || "unknown";
    appCounts[a] = (appCounts[a] || 0) + 1;
  });
  const topApps = Object.entries(appCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Btool Check" />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Terminal size={20} className="text-brand-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Splunk Btool Configuration Check</h2>
            <p className="text-[10px] text-gray-500">
              Validates .conf files for invalid keys, typos, and missing spec files.
              Requires the btoolcheck app installed on your Splunk instance.
            </p>
          </div>
        </div>

        {/* Command presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {BTOOL_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => setSpl(cmd.spl)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs transition-colors",
                spl === cmd.spl
                  ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                  : "bg-surface border border-surface-border text-gray-400 hover:text-gray-200"
              )}
              title={cmd.description}
            >
              {cmd.label}
            </button>
          ))}
        </div>

        {/* SPL input */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3 mb-4">
          <div className="flex gap-2">
            <div className="flex-1 flex items-start gap-2">
              <textarea
                value={spl}
                onChange={(e) => setSpl(e.target.value)}
                rows={2}
                className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-gray-100 font-mono outline-none focus:border-brand-500 resize-none"
                spellCheck={false}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runBtool(); } }}
              />
              <CopyButton text={spl} />
            </div>
            <button
              onClick={runBtool}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50 self-start"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-600">Cmd+Enter to run</p>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Summary cards */}
        {results.length > 0 && (
          <div className="flex gap-4 mb-4">
            <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
              <span className="text-2xl font-bold text-white">{results.length}</span>
              <p className="text-xs text-gray-500">Total Issues</p>
            </div>
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
                <span className={clsx("text-2xl font-bold", {
                  "text-red-400": type === "Invalid key",
                  "text-amber-400": type === "Possible typo",
                  "text-blue-400": type === "No spec file",
                  "text-gray-400": !MESSAGE_COLORS[type],
                })}>{count}</span>
                <p className="text-xs text-gray-500">{type}</p>
              </div>
            ))}
          </div>
        )}

        {/* Top apps with issues */}
        {topApps.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mb-4">
            <h3 className="text-xs font-semibold text-white mb-2">Top Apps with Issues</h3>
            <div className="flex flex-wrap gap-2">
              {topApps.map(([app, count]) => (
                <button
                  key={app}
                  onClick={() => setFilterText(app)}
                  className="rounded-lg px-2.5 py-1 text-[10px] bg-surface border border-surface-border text-gray-300 hover:bg-surface-hover transition-colors"
                >
                  {app} <span className="text-gray-500">({count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        {results.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Filter size={13} className="absolute left-2.5 top-2 text-gray-500" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface pl-8 pr-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500"
                placeholder="Filter by app, conf, stanza, key..."
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-gray-300 outline-none"
            >
              <option value="all">All Types</option>
              {Object.keys(typeCounts).map((t) => (
                <option key={t} value={t}>{t} ({typeCounts[t]})</option>
              ))}
            </select>
            <span className="text-[10px] text-gray-500">{filtered.length} of {results.length}</span>
          </div>
        )}

        {/* Results table */}
        {filtered.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised z-10">
                  <tr className="border-b border-surface-border">
                    {columns.map((col) => (
                      <th key={col} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                      {columns.map((col) => {
                        const val = row[col] || "";
                        if (col === "message_type") {
                          const colorClass = MESSAGE_COLORS[val] || "text-gray-400 bg-gray-500/10";
                          return (
                            <td key={col} className="px-3 py-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
                                {val}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={col} className="px-3 py-1.5 text-xs font-mono text-gray-300 whitespace-nowrap" title={val}>
                            {val}
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

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-brand-400" />
            <span className="ml-2 text-xs text-gray-500">Running btool check... this may take a moment</span>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-6 text-center">
            <Terminal size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">Click "Run" to execute btool check</p>
            <p className="text-[10px] text-gray-600 mt-1">Requires the btoolcheck app installed on your Splunk instance</p>
          </div>
        )}
      </div>
    </div>
  );
}
