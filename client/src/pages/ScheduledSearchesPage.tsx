import { useState, useEffect } from "react";
import { RefreshCw, Loader2, CalendarClock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import type { SplunkResult } from "../types/splunk";

const ENABLED_SPL = '| rest splunk_server=local "/servicesNS/-/-/saved/searches/" search="is_scheduled=1" search="disabled=0" | table title, cron_schedule, dispatch.earliest_time, dispatch.latest_time, eai:acl.app, eai:acl.owner, next_scheduled_time, actions, search';
const ALL_SPL = '| rest splunk_server=local "/servicesNS/-/-/saved/searches/" search="is_scheduled=1" | table title, cron_schedule, dispatch.earliest_time, dispatch.latest_time, eai:acl.app, eai:acl.owner, next_scheduled_time, actions, disabled, search';

export function ScheduledSearchesPage() {
  const [results, setResults] = useState<SplunkResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [spl, setSpl] = useState(ENABLED_SPL);
  const [editSpl, setEditSpl] = useState(false);
  const [customSpl, setCustomSpl] = useState(ENABLED_SPL);

  async function fetchScheduled(query?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(query || spl);
      setResults(res.results || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchScheduled(); }, [spl]);

  function toggleDisabled() {
    const next = !showDisabled;
    setShowDisabled(next);
    const newSpl = next ? ALL_SPL : ENABLED_SPL;
    setSpl(newSpl);
    setCustomSpl(newSpl);
  }

  const lowerFilter = filter.toLowerCase();
  const filtered = results.filter((r) => {
    if (!filter) return true;
    return Object.values(r).some((v) => String(v).toLowerCase().includes(lowerFilter));
  });

  const columns = [
    { key: "title", label: "Search Name" },
    { key: "cron_schedule", label: "Cron" },
    { key: "dispatch.earliest_time", label: "Earliest" },
    { key: "dispatch.latest_time", label: "Latest" },
    { key: "eai:acl.app", label: "App" },
    { key: "eai:acl.owner", label: "User" },
    { key: "next_scheduled_time", label: "Next Run" },
    { key: "actions", label: "Actions" },
  ];

  if (showDisabled) {
    columns.push({ key: "disabled", label: "Disabled" });
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Scheduled Searches Audit" />
      <div className="p-6">
        {/* Summary */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock size={14} className="text-brand-400" />
              <span className="text-2xl font-bold text-white">{results.length}</span>
            </div>
            <p className="text-xs text-gray-500">{showDisabled ? "Total Scheduled" : "Enabled Scheduled"}</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">{filtered.length}</span>
            </div>
            <p className="text-xs text-gray-500">Matching Filter</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-2xl font-bold text-amber-400">
                {results.filter((r) => r.actions && r.actions !== "").length}
              </span>
            </div>
            <p className="text-xs text-gray-500">With Alert Actions</p>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* SPL query display */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">SPL Query</span>
            <button
              onClick={() => setEditSpl(!editSpl)}
              className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
            >
              {editSpl ? "Cancel" : "Edit"}
            </button>
          </div>
          {editSpl ? (
            <div className="flex gap-2">
              <textarea
                value={customSpl}
                onChange={(e) => setCustomSpl(e.target.value)}
                rows={3}
                className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-none"
                spellCheck={false}
              />
              <button
                onClick={() => { setSpl(customSpl); setEditSpl(false); }}
                className="self-start rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors"
              >
                Run
              </button>
            </div>
          ) : (
            <pre className="text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{spl}</pre>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500"
            placeholder="Filter results..."
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={toggleDisabled}
              className="rounded"
            />
            Include disabled
          </label>
          <button
            onClick={() => fetchScheduled()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>

        {/* Results table */}
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised z-10">
                  <tr className="border-b border-surface-border">
                    {columns.map((col) => (
                      <th key={col.key} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors group">
                      {columns.map((col) => {
                        const val = row[col.key] || "";
                        if (col.key === "actions" && val) {
                          return (
                            <td key={col.key} className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {val.split(",").map((a: string) => (
                                  <span key={a.trim()} className="rounded px-1.5 py-0.5 text-[10px] bg-brand-500/10 text-brand-400">
                                    {a.trim()}
                                  </span>
                                ))}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "disabled") {
                          return (
                            <td key={col.key} className="px-3 py-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{
                                  backgroundColor: val === "1" || val === "true" ? "#ef4444" : "#10b981",
                                  boxShadow: val === "1" || val === "true" ? "0 0 4px #ef444480" : "0 0 4px #10b98180",
                                }}
                                title={val === "1" || val === "true" ? "Disabled" : "Enabled"}
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-3 py-2 text-xs font-mono text-gray-300 max-w-xs truncate" title={val}>
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

        {/* Hover to show search */}
        <p className="text-[10px] text-gray-600 mt-2">
          Hover a row and check browser tooltip on the Search Name for the full SPL
        </p>

        {filtered.length === 0 && !loading && (
          <p className="text-xs text-gray-500 text-center py-8">
            {filter ? `No results match "${filter}"` : "No scheduled searches found"}
          </p>
        )}
      </div>
    </div>
  );
}
