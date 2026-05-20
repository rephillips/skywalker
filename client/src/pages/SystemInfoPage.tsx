import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Play, Search, Terminal, ExternalLink, ChevronDown, ChevronUp, Crown, Server, Database } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import type { SplunkResult } from "../types/splunk";

const DEFAULT_SPL = "| rest splunk_server=local /services/server/info | table splunk_server guid serverName version os_name os_version numberOfCores numberOfVirtualCores physicalMemoryMB cpu_arch product_type license_state activeLicenseGroup";

const P0_SSH_DOC = "https://splunk.atlassian.net/wiki/spaces/CLOUDOPS/pages/1079049159599/P0+Security+Instruction+Doc#To-SSH-With-Sudo-Privilege";
const SSH_REASON = `--sudo --reason "Splunk support troubleshooting"`;

function shortHost(fqdn: string): string {
  return fqdn.split(".")[0];
}

function SshCommandRow({ label, host, icon }: { label: string; host: string; icon: React.ReactNode }) {
  const cmd = `p0 ssh ${host} ${SSH_REASON}`;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 border border-surface-border/50">
      <span className="shrink-0 text-gray-500">{icon}</span>
      <span className="text-[10px] text-gray-500 w-16 shrink-0">{label}</span>
      <code className="flex-1 text-[11px] font-mono text-emerald-300 truncate">{cmd}</code>
      <CopyButton text={cmd} size={13} />
    </div>
  );
}

function SshPanel() {
  const [open, setOpen] = useState(false);
  const [captain, setCaptain] = useState<string | null>(null);
  const [cm, setCm] = useState<string | null>(null);
  const [indexers, setIndexers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cmRes, idxRes, shcRes] = await Promise.all([
        api.search("index=_internal host=c0* sourcetype=splunkd component=ClusteringMgr | head 1 | table host"),
        api.search("| rest /services/server/info splunk_server=idx-i* | table splunk_server"),
        api.proxy("shcluster/member/members"),
      ]);

      if (cmRes.results?.length > 0) {
        setCm(shortHost(cmRes.results[0].host as string));
      }

      if (idxRes.results?.length > 0) {
        setIndexers(idxRes.results.map((r: any) => shortHost(r.splunk_server as string)).sort());
      }

      const entries: any[] = shcRes.data?.entry ?? [];
      const captainEntry = entries.find((e: any) => {
        const v = e.content?.is_captain;
        return v === "1" || v === true || v === 1;
      });
      if (captainEntry) {
        const label: string = captainEntry.content?.label || captainEntry.name || "";
        setCaptain(shortHost(label));
      }
    } catch {}
    setLoading(false);
    setFetched(true);
  }, []);

  const toggle = () => {
    setOpen(o => {
      if (!o && !fetched) fetchData();
      return !o;
    });
  };

  return (
    <div className="mb-4 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold text-white">SSH</span>
          <span className="text-[10px] text-gray-500">P0 access commands for this stack</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={12} className="animate-spin text-brand-400" />}
          {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-surface-border px-4 py-4 space-y-4">
          {/* P0 doc link + login examples */}
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <a
                href={P0_SSH_DOC}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-brand-400 hover:text-brand-200 transition-colors font-medium"
              >
                <ExternalLink size={11} />
                P0 SSH Instructions (Confluence)
              </a>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1.5">P0 Login</div>
              <div className="space-y-1">
                {["splunk-dev", "splunk-stg", "splunk-lve"].map(env => {
                  const cmd = `p0 login ${env}`;
                  return (
                    <div key={env} className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 border border-surface-border/50">
                      <code className="text-[11px] font-mono text-gray-300">{cmd}</code>
                      <CopyButton text={cmd} size={12} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SSH commands */}
          {loading && !fetched && (
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <Loader2 size={12} className="animate-spin" />
              Fetching hosts...
            </div>
          )}

          {fetched && (
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-2">SSH Commands</div>

              {cm && (
                <SshCommandRow
                  label="CM"
                  host={cm}
                  icon={<Database size={12} />}
                />
              )}

              {captain && (
                <SshCommandRow
                  label="Captain"
                  host={captain}
                  icon={<Crown size={12} />}
                />
              )}

              {indexers.map(idx => (
                <SshCommandRow
                  key={idx}
                  label="Indexer"
                  host={idx}
                  icon={<Server size={12} />}
                />
              ))}

              {!cm && !captain && indexers.length === 0 && (
                <p className="text-[11px] text-gray-500">No hosts found — check that the stack is reachable.</p>
              )}
            </div>
          )}

          {/* SCP reference */}
          <div className="border-t border-surface-border pt-4 space-y-3">
            <div className="text-[9px] uppercase tracking-wide text-gray-500">SCP via P0</div>
            <div className="space-y-3">
              {/* Local → Remote */}
              <div>
                <div className="text-[10px] text-gray-400 mb-1.5">1. Copy local file to remote host</div>
                {(() => {
                  const exHost = cm || captain || indexers[0] || "<host>";
                  const cmd = `p0 scp ./report.pdf ${exHost}:/var/www/reports/`;
                  return (
                    <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 border border-surface-border/50">
                      <code className="flex-1 text-[11px] font-mono text-sky-300 truncate">{cmd}</code>
                      <CopyButton text={cmd} size={13} />
                    </div>
                  );
                })()}
                <p className="text-[10px] text-gray-600 mt-1">
                  P0 issues a temporary key and runs <code className="text-gray-400">scp ./report.pdf ubuntu@&lt;instance-id&gt;:/var/www/reports/</code>
                </p>
              </div>
              {/* Remote → Local */}
              <div>
                <div className="text-[10px] text-gray-400 mb-1.5">2. Copy remote file to local</div>
                {(() => {
                  const exHost = cm || captain || indexers[0] || "<host>";
                  const cmd = `p0 scp ${exHost}:/var/log/splunk/splunkd.log ./splunkd.log`;
                  return (
                    <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 border border-surface-border/50">
                      <code className="flex-1 text-[11px] font-mono text-sky-300 truncate">{cmd}</code>
                      <CopyButton text={cmd} size={13} />
                    </div>
                  );
                })()}
                <p className="text-[10px] text-gray-600 mt-1">
                  Retrieves the remote file into your current directory.
                </p>
              </div>
            </div>
          </div>

          {/* Refresh */}
          {fetched && (
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 text-[10px] text-brand-400 hover:text-brand-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              Refresh hosts
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SystemInfoPage() {
  const [spl, setSpl] = useState(DEFAULT_SPL);
  const [results, setResults] = useState<SplunkResult[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [allFields, setAllFields] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.search(spl);
      setResults(response.results);
      if (response.results && response.results.length > 0) {
        setColumns(Object.keys(response.results[0]));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl]);

  // Fetch full server info via REST proxy
  useEffect(() => {
    api.proxy("server/info").then((res) => {
      if (res.status === "ok" && res.data?.entry?.[0]?.content) {
        setAllFields(res.data.entry[0].content);
      }
    }).catch(() => {});
  }, []);

  // Run default search on mount
  useEffect(() => {
    runSearch();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="System Info" />
      <div className="p-6 max-w-4xl">
        <SshPanel />
        {/* Editable SPL query */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Search size={14} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-400">System Info Query</span>
          </div>
          <div className="flex gap-2">
            <textarea
              value={spl}
              onChange={(e) => setSpl(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors resize-none"
              spellCheck={false}
            />
            <button
              onClick={runSearch}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50 self-start"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setSpl(DEFAULT_SPL)}
              className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
            >
              Reset to default
            </button>
            <span className="text-[10px] text-gray-600">Cmd+Enter to run</span>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Search results */}
        {results && results.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5 mb-4">
            <h2 className="text-sm font-semibold text-white mb-4">Query Results</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {columns.map((col) => {
                const value = results[0][col];
                if (!value) return null;
                return (
                  <div key={col}>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide block">
                      {col}
                    </span>
                    <span className="text-sm text-gray-200 font-mono">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
            {results.length > 1 && (
              <div className="mt-4 overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border">
                      {columns.map((col) => (
                        <th key={col} className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                        {columns.map((col) => (
                          <td key={col} className="px-3 py-1.5 text-xs font-mono text-gray-300">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REST API reference */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mb-4">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-2">
            REST API Endpoint
          </span>
          <pre className="text-xs font-mono text-blue-400/80">
            GET /services/server/info?output_mode=json
          </pre>
        </div>

        {/* Full server properties from REST */}
        {allFields && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">All Server Properties</h3>
              <span className="text-[10px] text-gray-500">{Object.keys(allFields).length} properties</span>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised">
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Property</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(allFields)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                      <tr key={key} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                        <td className="px-3 py-1.5 text-xs font-mono text-gray-400">{key}</td>
                        <td className="px-3 py-1.5 text-xs font-mono text-gray-200 break-all">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
