import { useState, useCallback } from "react";
import { Search, Loader2, Filter, Copy, Check } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { JobInspector } from "../components/panels/JobInspector";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "inspector" | "log" | "audit" | "indexers";

// ─── Log viewer ───────────────────────────────────────────────────────────────

function logLineClass(line: string): string {
  if (line.includes("ERROR")) return "text-red-400";
  if (line.includes("WARN"))  return "text-yellow-400";
  if (line.includes("INFO"))  return "text-gray-300";
  return "text-gray-500";
}

function SearchLogTab({ log }: { log: string }) {
  const [filter, setFilter] = useState("");

  const lines = log.split("\n");
  const filtered = filter
    ? lines.filter(l => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-surface-border shrink-0">
        <div className="relative">
          <Filter size={11} className="absolute left-2.5 top-[7px] text-gray-500" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter lines…"
            className="rounded-lg border border-surface-border bg-surface pl-7 pr-2 py-1 text-[11px] text-gray-100 outline-none focus:border-emerald-500/60 w-52"
          />
        </div>
        <span className="text-[10px] text-gray-600">
          {filtered.length} / {lines.length} lines
        </span>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        <pre className="text-[11px] font-mono leading-5 whitespace-pre-wrap break-all">
          {filtered.map((line, i) => (
            <span key={i} className={logLineClass(line)}>
              {line}{"\n"}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

export function SearchAnalyzerPage() {
  const [sid, setSid]         = useState("");
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [log, setLog]           = useState<string | null>(null);
  const [hasJob, setHasJob]     = useState(false);
  const [auditRows, setAuditRows]     = useState<any[]>([]);
  const [indexerRows, setIndexerRows] = useState<any[]>([]);
  const [activeTab, setActiveTab]     = useState<Tab>("inspector");
  const [earliest, setEarliest]       = useState("-24h");
  const [latest, setLatest]           = useState("now");

  const analyze = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setLog(null);
    setHasJob(false);
    setAuditRows([]);
    setIndexerRows([]);
    setSid("");

    const auditSpl   = `index=_audit sourcetype=audittrail host IN (sh-i*) action=search info=completed search_id='${trimmed}'`;
    const indexerSpl = `index=_internal source=*remote_searches.log host IN (idx-i-*) *${trimmed}* | stats max(elapsedTime) as elapsedTime by host`;

    try {
      const [logResult, jobResult, auditResult, indexerResult] = await Promise.allSettled([
        api.searchLog(trimmed),
        api.proxy("search/v2/jobs/" + encodeURIComponent(trimmed)),
        api.search(auditSpl, earliest, latest),
        api.search(indexerSpl, earliest, latest),
      ]);

      let gotSomething = false;

      if (logResult.status === "fulfilled") {
        const data = logResult.value;
        const logText =
          data?.log ??
          data?.entry?.[0]?.content ??
          JSON.stringify(data, null, 2);
        setLog(typeof logText === "string" ? logText : JSON.stringify(logText, null, 2));
        gotSomething = true;
      }

      if (jobResult.status === "fulfilled" && jobResult.value?.data?.entry?.[0]?.content) {
        setHasJob(true);
        gotSomething = true;
      }

      if (auditResult.status === "fulfilled") {
        const rows = auditResult.value?.results ?? [];
        setAuditRows(rows);
        if (rows.length > 0) gotSomething = true;
      }

      if (indexerResult.status === "fulfilled") {
        const rows = indexerResult.value?.results ?? [];
        setIndexerRows(rows);
        if (rows.length > 0) gotSomething = true;
      }

      if (!gotSomething) {
        const errMsg =
          (logResult.status === "rejected" ? (logResult.reason as Error).message : null) ??
          (jobResult.status === "rejected" ? (jobResult.reason as Error).message : null) ??
          "No data found for this SID";
        setError(errMsg);
        return;
      }

      setSid(trimmed);
      // Default to inspector if job data available, else log
      setActiveTab(hasJob || jobResult.status === "fulfilled" ? "inspector" : "log");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [input, earliest, latest]);

  const hasResults = !!sid && (hasJob || log !== null);

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "inspector", label: "Job Inspector" },
    { id: "log",       label: "search.log" },
    { id: "audit",     label: "Audit Trail",    badge: auditRows.length },
    { id: "indexers",  label: "Indexer Times",  badge: indexerRows.length },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar title="Search Analyzer" hideTimePicker />

      <div className="flex-1 overflow-hidden px-5 py-4 flex flex-col gap-4 min-h-0">

        {/* ── SID input card ── */}
        <div className="rounded-xl border border-emerald-500/20 bg-surface-raised p-4 shrink-0">
          <div className="flex items-end gap-3 mb-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-500">Search Job ID (SID)</label>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); analyze(); } }}
                placeholder="e.g. 1718000000.12345"
                spellCheck={false}
                className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-emerald-500/60 placeholder:text-gray-600"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-500">Earliest</label>
              <input
                type="text"
                value={earliest}
                onChange={e => setEarliest(e.target.value)}
                placeholder="-24h"
                className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-emerald-500/60 w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-500">Latest</label>
              <input
                type="text"
                value={latest}
                onChange={e => setLatest(e.target.value)}
                placeholder="now"
                className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-mono text-gray-200 outline-none focus:border-emerald-500/60 w-28"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={analyze}
              disabled={loading || !input.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Analyze
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-600">⌘+Enter to analyze</p>

          {error && (
            <div className="mt-3">
              <ErrorAlert message={error} />
            </div>
          )}
        </div>

        {/* ── Results area ── */}
        {hasResults && (
          <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden flex-1 flex flex-col min-h-0">
            {/* Tab bar */}
            <div className="flex border-b border-surface-border px-4 pt-3 gap-1 shrink-0">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-t-md whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeTab === t.id
                      ? "text-emerald-300 border-emerald-400 bg-emerald-500/10"
                      : "text-gray-500 border-transparent hover:text-gray-300"
                  }`}
                >
                  {t.label}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 leading-none">
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {activeTab === "inspector" && (
                <div className="flex-1 overflow-auto p-5 h-full">
                  <JobInspector sid={sid} />
                </div>
              )}

              {activeTab === "log" && log !== null && (
                <div className="h-full flex flex-col min-h-0">
                  <SearchLogTab log={log} />
                </div>
              )}

              {activeTab === "log" && log === null && (
                <div className="flex items-center justify-center h-full text-[11px] text-gray-500">
                  No search.log available for this job.
                </div>
              )}

              {activeTab === "audit" && (
                <div className="overflow-auto h-full">
                  {auditRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-[11px] text-gray-500">
                      <p>No audit trail events found.</p>
                      <code className="text-[10px] font-mono text-emerald-400/60 px-3 py-1.5 rounded bg-surface border border-surface-border">
                        index=_audit sourcetype=audittrail host IN (sh-i*) action=search info=completed search_id='{sid}'
                      </code>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col gap-4">
                      {auditRows.map((row, i) => {
                        const HIGHLIGHT = ["user", "exec_time", "total_run_time", "search_type", "host", "splunk_server", "search"];
                        const highlight = HIGHLIGHT.filter(k => row[k] != null && row[k] !== "");
                        const rest = Object.entries(row)
                          .filter(([k]) => !k.startsWith("_") && !HIGHLIGHT.includes(k) && row[k] !== "")
                          .sort(([a], [b]) => a.localeCompare(b));
                        return (
                          <div key={i} className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden">
                            <div className="px-4 py-2 border-b border-surface-border bg-surface/40 flex items-center gap-2">
                              <span className="text-[10px] text-gray-500 font-mono">{row._time ?? `Event ${i + 1}`}</span>
                              {row.host && <span className="text-[10px] font-mono text-emerald-400/70">{row.host}</span>}
                            </div>
                            {/* Key highlights */}
                            <div className="px-4 py-3 grid grid-cols-3 gap-x-6 gap-y-2">
                              {highlight.map(k => (
                                <div key={k}>
                                  <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">{k}</div>
                                  <div className={`text-[11px] font-mono break-all ${k === "search" ? "text-emerald-300 col-span-3" : "text-gray-200"}`}>
                                    {String(row[k])}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Remaining fields collapsible */}
                            {rest.length > 0 && (
                              <details className="border-t border-surface-border">
                                <summary className="px-4 py-1.5 text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 select-none">
                                  {rest.length} more fields
                                </summary>
                                <div className="px-4 pb-3 grid grid-cols-3 gap-x-6 gap-y-1.5 pt-2">
                                  {rest.map(([k, v]) => (
                                    <div key={k}>
                                      <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">{k}</div>
                                      <div className="text-[11px] font-mono text-gray-400 break-all">{String(v)}</div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                            {/* Raw event */}
                            {row._raw && (
                              <details className="border-t border-surface-border">
                                <summary className="px-4 py-1.5 text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 select-none">
                                  Raw event
                                </summary>
                                <pre className="px-4 pb-3 pt-2 text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all">
                                  {row._raw}
                                </pre>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "indexers" && (
                <div className="overflow-auto h-full">
                  {indexerRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-[11px] text-gray-500">
                      <p>No indexer timing data found.</p>
                      <code className="text-[10px] font-mono text-emerald-400/60 px-3 py-1.5 rounded bg-surface border border-surface-border">
                        index=_internal source=*remote_searches.log host IN (idx-i-*) *{sid}*
                      </code>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden">
                        <div className="px-4 py-2 border-b border-surface-border flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">{indexerRows.length} indexer{indexerRows.length !== 1 ? "s" : ""}</span>
                          <code className="text-[10px] font-mono text-emerald-400/60">max(elapsedTime) by host</code>
                        </div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-surface-border text-[9px] uppercase tracking-wide text-gray-500">
                              <th className="text-left px-4 py-2 font-medium">Host</th>
                              <th className="text-right px-4 py-2 font-medium w-36">Elapsed Time (s)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...indexerRows]
                              .sort((a, b) => Number(b.elapsedTime) - Number(a.elapsedTime))
                              .map((row, i) => {
                                const max = Math.max(...indexerRows.map(r => Number(r.elapsedTime) || 0));
                                const pct = max > 0 ? (Number(row.elapsedTime) / max) * 100 : 0;
                                return (
                                  <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20">
                                    <td className="px-4 py-2 font-mono text-gray-200">{row.host}</td>
                                    <td className="px-4 py-2 text-right relative">
                                      <div className="absolute inset-y-0 right-0 bg-emerald-500/10"
                                        style={{ width: `${pct}%` }} />
                                      <span className={`relative font-mono ${pct === 100 ? "text-amber-400" : "text-gray-300"}`}>
                                        {Number(row.elapsedTime).toFixed(3)}s
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasResults && !loading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/10 bg-surface-raised">
            <Search size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">Enter a SID to inspect a search job</p>
            <p className="text-[11px] text-gray-600">Fetches job properties, search.log, and dispatch bundle</p>
          </div>
        )}
      </div>
    </div>
  );
}
