import { useState } from "react";
import { Terminal, Play, Loader2, Filter, Package } from "lucide-react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import type { SplunkResult } from "../types/splunk";

const BTOOL_PRESETS = [
  { group: "btool check", items: [
    { label: "Check All", spl: "| btoolcheck", desc: "Validate all conf files for errors" },
    { label: "Check by App", spl: "| btoolcheck app=", desc: "Filter check results by app" },
    { label: "Check by Conf", spl: "| btoolcheck conf=", desc: "Filter check results by conf type" },
  ]},
  { group: "btool list", items: [
    { label: "inputs.conf", spl: "| btool inputs list --debug splunk_server=local", desc: "Show merged inputs.conf with file sources" },
    { label: "props.conf", spl: "| btool props list --debug splunk_server=local", desc: "Show merged props.conf with file sources" },
    { label: "transforms.conf", spl: "| btool transforms list --debug splunk_server=local", desc: "Show merged transforms.conf" },
    { label: "indexes.conf", spl: "| btool indexes list --debug splunk_server=local", desc: "Show merged indexes.conf" },
    { label: "server.conf", spl: "| btool server list --debug splunk_server=local", desc: "Show merged server.conf" },
    { label: "outputs.conf", spl: "| btool outputs list --debug splunk_server=local", desc: "Show merged outputs.conf" },
    { label: "limits.conf", spl: "| btool limits list --debug splunk_server=local", desc: "Show merged limits.conf" },
    { label: "authentication.conf", spl: "| btool authentication list --debug splunk_server=local", desc: "Show merged authentication.conf" },
    { label: "authorize.conf", spl: "| btool authorize list --debug splunk_server=local", desc: "Show merged authorize.conf" },
    { label: "savedsearches.conf", spl: "| btool savedsearches list --debug splunk_server=local", desc: "Show merged savedsearches.conf" },
    { label: "web.conf", spl: "| btool web list --debug splunk_server=local", desc: "Show merged web.conf" },
    { label: "distsearch.conf", spl: "| btool distsearch list --debug splunk_server=local", desc: "Show merged distsearch.conf" },
  ]},
  { group: "btool list (app context)", items: [
    { label: "App Context", spl: "| btool props list --debug --app --user splunk_server=local", desc: "Show props in current app/user context" },
    { label: "Specific App", spl: "| btool props list --debug --app=search splunk_server=local", desc: "Show props for search app" },
    { label: "All Apps", spl: "| btool props list --debug --allapps splunk_server=local", desc: "Show props for all apps individually" },
  ]},
  { group: "btool list (kvpairs)", items: [
    { label: "Props KV Pairs", spl: "| btool props list --debug --kvpairs splunk_server=local", desc: "Each key=value as separate event" },
    { label: "Indexes KV Pairs", spl: "| btool indexes list --debug --kvpairs splunk_server=local", desc: "Indexes key=value as separate events" },
  ]},
  { group: "props layer", items: [
    { label: "Layer by Sourcetype", spl: '| btool props layer --sourcetype="syslog" --debug splunk_server=local', desc: "Combined props for a sourcetype" },
    { label: "Layer by Source+ST", spl: '| btool props layer --sourcetype="syslog" --source="udp:514" --debug splunk_server=local', desc: "Combined props for source+sourcetype" },
  ]},
  { group: "bundlefiles", items: [
    { label: "Bundle Files", spl: "| bundlefiles", desc: "List all files in the search bundle" },
    { label: "Bundle Computed", spl: "| bundlefiles bundle=computed", desc: "Computed bundle approximation" },
    { label: "Bundle Exclusions", spl: "| bundlefiles bundle=computed_exclusions", desc: "Show denylist exclusions" },
    { label: "KVStore in Bundle", spl: "| bundlefiles | search kvstore_collection=*", desc: "Find KVStore collections in bundle" },
    { label: "Large Files", spl: "| bundlefiles | sort -bytes | head 20", desc: "Top 20 largest files in bundle" },
  ]},
  { group: "Useful combos", items: [
    { label: "DDAA vs Retention", spl: `| btool indexes list splunk_server=local
| rename archiver.coldStorageRetentionPeriod as archive_days btool.stanza as index
| eval searchable_days=round(frozenTimePeriodInSecs/60/60/24)
| where isnotnull(archive_days) AND (frozenTimePeriodInSecs=0 OR searchable_days>archive_days)
| stats values(searchable_days) values(archive_days) by index`, desc: "Find indexes where DDAA < searchable retention" },
    { label: "Remote-Only Indexes", spl: `| btool indexes list
| rename btool.stanza as index
| search index!=*:* NOT deleted=true
| stats values(splunk_server) as hosts by index
| where NOT match(hosts, "local")`, desc: "Indexes on peers but not search head" },
  ]},
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
  const [activeGroup, setActiveGroup] = useState("btool check");

  async function runCommand() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(spl);
      const rows = res.results || [];
      setResults(rows);
      if (rows.length > 0) {
        setColumns(Object.keys(rows[0]).filter((k) => !k.startsWith("_") || k === "_raw"));
      } else {
        setColumns([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const lowerFilter = filterText.toLowerCase();
  const filtered = results.filter((r) => {
    if (!filterText) return true;
    return Object.values(r).some((v) => String(v).toLowerCase().includes(lowerFilter));
  });

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Btool & Bundle Inspector" />
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — command presets */}
        <div className="w-64 shrink-0 border-r border-surface-border flex flex-col overflow-auto">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={14} className="text-brand-400" />
              <span className="text-xs font-semibold text-white">Commands</span>
            </div>
            {BTOOL_PRESETS.map((group) => (
              <div key={group.group} className="mb-3">
                <button
                  onClick={() => setActiveGroup(activeGroup === group.group ? "" : group.group)}
                  className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block hover:text-gray-300 transition-colors"
                >
                  {group.group}
                </button>
                {(activeGroup === group.group || activeGroup === "") && (
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => setSpl(item.spl)}
                        className={clsx(
                          "text-left rounded-md px-2 py-1.5 text-[11px] transition-colors",
                          spl === item.spl
                            ? "bg-brand-500/10 text-brand-400"
                            : "text-gray-400 hover:text-gray-200 hover:bg-surface-hover"
                        )}
                        title={item.desc}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col min-w-0">
          {/* SPL input */}
          <div className="rounded-xl border border-surface-border bg-surface-raised p-3 mb-4">
            <div className="flex gap-2">
              <div className="flex-1 flex items-start gap-2">
                <textarea
                  value={spl}
                  onChange={(e) => setSpl(e.target.value)}
                  rows={3}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-gray-100 font-mono outline-none focus:border-brand-500 resize-y"
                  spellCheck={false}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runCommand(); } }}
                />
                <CopyButton text={spl} />
              </div>
              <button
                onClick={runCommand}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50 self-start"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-600">Cmd+Enter to run • Requires Admin's Little Helper or btoolcheck app</p>
          </div>

          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

          {/* Summary */}
          {results.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400">{results.length} results</span>
              <div className="relative">
                <Filter size={13} className="absolute left-2.5 top-2 text-gray-500" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="rounded-lg border border-surface-border bg-surface pl-8 pr-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500 w-64"
                  placeholder="Filter results..."
                />
              </div>
            </div>
          )}

          {/* Results — vertical cards */}
          {filtered.length > 0 && (
            <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-3">
              {filtered.map((row, i) => (
                <div key={i} className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {columns.map((col) => {
                        const val = row[col] || "";
                        if (!val) return null;
                        return (
                          <tr key={col} className="border-b border-surface-border/30 hover:bg-surface-hover/50 transition-colors">
                            <td className="px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap w-40 align-top">
                              {col}
                            </td>
                            <td className="px-3 py-1.5 text-xs font-mono text-gray-300 break-all">
                              {col === "message_type" && MESSAGE_COLORS[val] ? (
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${MESSAGE_COLORS[val]}`}>
                                  {val}
                                </span>
                              ) : col === "_raw" ? (
                                <pre className="whitespace-pre-wrap">{val}</pre>
                              ) : (
                                val
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-brand-400" />
              <span className="ml-2 text-xs text-gray-500">Running command... this may take a moment</span>
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center">
              <Terminal size={28} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-400">Select a command from the left panel or edit the SPL above</p>
              <p className="text-[10px] text-gray-600 mt-1">
                Requires Admin's Little Helper (btool, bundlefiles) or btoolcheck app
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
