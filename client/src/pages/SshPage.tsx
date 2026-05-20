import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Loader2, Terminal, ExternalLink, ChevronDown, ChevronUp, Crown, Server, Database, Search } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { CopyButton } from "../components/common/CopyButton";

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
  const [open, setOpen] = useState(true);
  const [captain, setCaptain] = useState<string | null>(null);
  const [otherShs, setOtherShs] = useState<string[]>([]);
  const [cm, setCm] = useState<string | null>(null);
  const [indexers, setIndexers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cmRes, idxRes, shRes, shcRes] = await Promise.all([
        api.search("index=_internal host=c0* sourcetype=splunkd component=ClusteringMgr | head 1 | table host"),
        api.search("| rest /services/server/info splunk_server=idx-i* | table splunk_server"),
        api.search("| rest /services/server/info splunk_server=sh-i* | table splunk_server"),
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
      const captainShort = captainEntry
        ? shortHost(captainEntry.content?.label || captainEntry.name || "")
        : null;
      if (captainShort) setCaptain(captainShort);

      if (shRes.results?.length > 0) {
        const allShs = shRes.results.map((r: any) => shortHost(r.splunk_server as string)).sort();
        setOtherShs(captainShort ? allShs.filter(h => h !== captainShort) : allShs);
      }
    } catch {}
    setLoading(false);
    setFetched(true);
  }, []);

  useEffect(() => { fetchData(); }, []);

  const toggle = () => setOpen(o => !o);

  return (
    <div className="mb-4 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
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
                      <code className="text-[11px] font-mono text-emerald-300">{cmd}</code>
                      <CopyButton text={cmd} size={12} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

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
                <SshCommandRow label="CM" host={cm} icon={<Database size={12} />} />
              )}
              {captain && (
                <SshCommandRow label="Captain" host={captain} icon={<Crown size={12} />} />
              )}
              {otherShs.map(sh => (
                <SshCommandRow key={sh} label="SH" host={sh} icon={<Search size={12} />} />
              ))}
              {indexers.map(idx => (
                <SshCommandRow key={idx} label="Indexer" host={idx} icon={<Server size={12} />} />
              ))}
              {!cm && !captain && otherShs.length === 0 && indexers.length === 0 && (
                <p className="text-[11px] text-gray-500">No hosts found — check that the stack is reachable.</p>
              )}
            </div>
          )}

          <div className="border-t border-surface-border pt-4 space-y-3">
            <div className="text-[9px] uppercase tracking-wide text-gray-500">SCP via P0</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-gray-400 mb-1.5">1. Copy local file to remote host</div>
                {(() => {
                  const exHost = cm || captain || indexers[0] || "<host>";
                  const cmd = `p0 scp ./report.pdf ${exHost}:/var/www/reports/`;
                  return (
                    <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 border border-surface-border/50">
                      <code className="flex-1 text-[11px] font-mono text-emerald-300 truncate">{cmd}</code>
                      <CopyButton text={cmd} size={13} />
                    </div>
                  );
                })()}
              </div>
              <div>
                <div className="text-[10px] text-gray-400 mb-1.5">2. Copy remote file to local</div>
                {(() => {
                  const exHost = cm || captain || indexers[0] || "<host>";
                  const cmd = `p0 scp ${exHost}:/var/log/splunk/splunkd.log ./splunkd.log`;
                  return (
                    <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 border border-surface-border/50">
                      <code className="flex-1 text-[11px] font-mono text-emerald-300 truncate">{cmd}</code>
                      <CopyButton text={cmd} size={13} />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

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

export function SshPage() {
  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="SSH" hideTimePicker />
      <div className="p-6 max-w-3xl">
        <SshPanel />
      </div>
    </div>
  );
}
