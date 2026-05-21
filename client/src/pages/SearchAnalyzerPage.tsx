import { useState, useCallback, useEffect } from "react";
import { Search, Loader2, Download, ExternalLink, Filter, Copy, Check } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { JobInspector } from "../components/panels/JobInspector";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "inspector" | "log" | "audit" | "download";

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

// ─── Download tab ─────────────────────────────────────────────────────────────

function DownloadTab({ sid, webUrl }: { sid: string; webUrl: string | null }) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied]           = useState(false);

  async function downloadDispatch() {
    setDownloading(true);
    try {
      const data = await api.dispatchFull(sid);
      const binary = atob(data.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/gzip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dispatch_${sid}.tar.gz`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${(err as Error).message}`);
    } finally {
      setDownloading(false);
    }
  }

  function copySid() {
    navigator.clipboard.writeText(sid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const inspectorUrl = webUrl
    ? `${webUrl}/en-US/app/search/job_inspector?sid=${encodeURIComponent(sid)}`
    : null;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Download dispatch */}
      <div className="rounded-xl border border-emerald-500/20 bg-surface-raised p-5 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-white mb-1">Download Dispatch Bundle</p>
          <p className="text-[11px] text-gray-500">Downloads the full dispatch directory as a <code className="font-mono text-emerald-300">.tar.gz</code> archive. Useful for offline analysis or sharing with Splunk Support.</p>
        </div>
        <button
          onClick={downloadDispatch}
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 self-start"
        >
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Download Dispatch
        </button>
      </div>

      {/* Open in Splunk */}
      {inspectorUrl && (
        <div className="rounded-xl border border-emerald-500/20 bg-surface-raised p-5 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-white mb-1">Open in Splunk Job Inspector</p>
            <p className="text-[11px] text-gray-500">Opens this job in the native Splunk Web Job Inspector interface.</p>
          </div>
          <a
            href={inspectorUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors self-start"
          >
            <ExternalLink size={12} />
            Open in Splunk Job Inspector ↗
          </a>
        </div>
      )}

      {/* Copyable SID */}
      <div className="rounded-xl border border-emerald-500/20 bg-surface-raised p-5 flex flex-col gap-2">
        <p className="text-xs font-semibold text-white">Search Job ID</p>
        <div className="flex items-center gap-2">
          <span className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-mono text-emerald-300 truncate select-all">
            {sid}
          </span>
          <button
            onClick={copySid}
            className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-400 hover:text-white hover:border-emerald-500/40 transition-colors shrink-0"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
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
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("inspector");
  const [webUrl, setWebUrl]     = useState<string | null>(null);

  // Load webUrl once
  useEffect(() => {
    api.config().then(cfg => setWebUrl(cfg.webUrl || null)).catch(() => {});
  }, []);

  const analyze = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setLog(null);
    setHasJob(false);
    setAuditRows([]);
    setSid("");

    const auditSpl = `index=_audit sourcetype=audittrail host IN (sh-i*) action=search info=completed search_id='${trimmed}'`;

    try {
      const [logResult, jobResult, auditResult] = await Promise.allSettled([
        api.searchLog(trimmed),
        api.proxy("search/v2/jobs/" + encodeURIComponent(trimmed)),
        api.search(auditSpl),
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
  }, [input]);

  const hasResults = !!sid && (hasJob || log !== null);

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "inspector", label: "Job Inspector" },
    { id: "log",       label: "search.log" },
    { id: "audit",     label: "Audit Trail", badge: auditRows.length },
    { id: "download",  label: "Download" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar title="Search Analyzer" hideTimePicker />

      <div className="flex-1 overflow-hidden px-5 py-4 flex flex-col gap-4 min-h-0">

        {/* ── SID input card ── */}
        <div className="rounded-xl border border-emerald-500/20 bg-surface-raised p-4 shrink-0">
          <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-2">
            Search Job ID (SID)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); analyze(); } }}
              placeholder="e.g. 1718000000.12345"
              spellCheck={false}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-emerald-500/60 placeholder:text-gray-600"
            />
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
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "download" && (
                <div className="overflow-auto h-full">
                  <DownloadTab sid={sid} webUrl={webUrl} />
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
