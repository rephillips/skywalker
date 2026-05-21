import { useState } from "react";
import { Terminal, Play, Loader2, Filter, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import { parseBtoolRows, type BtoolRow } from "../utils/btool";
import type { SplunkResult } from "../types/splunk";

const BTOOL_PRESETS = [
  { group: "btool list", items: [
    { label: "inputs.conf",        spl: "| btool inputs list splunk_server=local",        desc: "Show merged inputs.conf with file sources" },
    { label: "props.conf",         spl: "| btool props list splunk_server=local",          desc: "Show merged props.conf" },
    { label: "transforms.conf",    spl: "| btool transforms list splunk_server=local",     desc: "Show merged transforms.conf" },
    { label: "indexes.conf",       spl: "| btool indexes list splunk_server=local",        desc: "Show merged indexes.conf" },
    { label: "server.conf",        spl: "| btool server list splunk_server=local",         desc: "Show merged server.conf" },
    { label: "outputs.conf",       spl: "| btool outputs list splunk_server=local",        desc: "Show merged outputs.conf" },
    { label: "limits.conf",        spl: "| btool limits list splunk_server=local",         desc: "Show merged limits.conf" },
    { label: "authentication.conf",spl: "| btool authentication list splunk_server=local", desc: "Show merged authentication.conf" },
    { label: "authorize.conf",     spl: "| btool authorize list splunk_server=local",      desc: "Show merged authorize.conf" },
    { label: "savedsearches.conf", spl: "| btool savedsearches list splunk_server=local",  desc: "Show merged savedsearches.conf" },
    { label: "web.conf",           spl: "| btool web list splunk_server=local",            desc: "Show merged web.conf" },
    { label: "distsearch.conf",    spl: "| btool distsearch list splunk_server=local",     desc: "Show merged distsearch.conf" },
  ]},
  { group: "btool list (app context)", items: [
    { label: "Specific App",  spl: "| btool props list --app=search splunk_server=local",  desc: "Show props for search app" },
    { label: "All Apps",      spl: "| btool props list --allapps splunk_server=local",      desc: "Show props for all apps individually" },
  ]},
  { group: "props layer", items: [
    { label: "Layer by Sourcetype", spl: '| btool props layer --sourcetype="syslog" splunk_server=local',                          desc: "Combined props for a sourcetype" },
    { label: "Layer by Source+ST",  spl: '| btool props layer --sourcetype="syslog" --source="udp:514" splunk_server=local',        desc: "Combined props for source+sourcetype" },
  ]},
  { group: "bundlefiles", items: [
    { label: "Bundle Files",    spl: "| bundlefiles",                                  desc: "List all files in the search bundle" },
    { label: "Bundle Computed", spl: "| bundlefiles bundle=computed",                  desc: "Computed bundle approximation" },
    { label: "Bundle Exclusions",spl: "| bundlefiles bundle=computed_exclusions",      desc: "Show denylist exclusions" },
    { label: "KVStore in Bundle",spl: "| bundlefiles | search kvstore_collection=*",   desc: "Find KVStore collections in bundle" },
    { label: "Large Files",      spl: "| bundlefiles | sort -bytes | head 20",         desc: "Top 20 largest files in bundle" },
  ]},
  { group: "Useful combos", items: [
    { label: "DDAA vs Retention", spl:
`| btool indexes list splunk_server=local
| rename archiver.coldStorageRetentionPeriod as archive_days btool.stanza as index
| eval searchable_days=round(frozenTimePeriodInSecs/60/60/24)
| where isnotnull(archive_days) AND (frozenTimePeriodInSecs=0 OR searchable_days>archive_days)
| stats values(searchable_days) values(archive_days) by index`, desc: "Find indexes where DDAA < searchable retention" },
    { label: "Remote-Only Indexes", spl:
`| btool indexes list
| rename btool.stanza as index
| search index!=*:* NOT deleted=true
| stats values(splunk_server) as hosts by index
| where NOT match(hosts, "local")`, desc: "Indexes on peers but not search head" },
  ]},
];

const PREVIEW_ROWS = 25;

export function BtoolPage() {
  const [spl, setSpl]               = useState("| btool distsearch list splunk_server=local");
  const [rawResults, setRawResults] = useState<SplunkResult[]>([]);
  const [columns, setColumns]       = useState<string[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [showRaw, setShowRaw]       = useState(false);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState("btool list");

  async function runCommand() {
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    setShowRaw(false);
    try {
      const res = await api.search(spl);
      const rows = res.results || [];
      setRawResults(rows);
      setColumns(rows.length > 0 ? Object.keys(rows[0]).filter(k => !k.startsWith("_") || k === "_raw") : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Parse into btool rows (all stanzas). If result has stanza structure, render
  // as btool format. Otherwise fall back to raw table.
  const btoolRows = parseBtoolRows(rawResults);
  const isBtoolOutput = btoolRows.some(r => r.isStanza);

  // Filter btool rows by text
  const filteredRows = filterText
    ? btoolRows.filter(r => r.file.toLowerCase().includes(filterText.toLowerCase()) || r.content.toLowerCase().includes(filterText.toLowerCase()))
    : btoolRows;

  // Group into stanza sections
  const groups: { stanza: string; rows: BtoolRow[] }[] = [];
  let current: { stanza: string; rows: BtoolRow[] } | null = null;
  for (const row of filteredRows) {
    if (row.isStanza) {
      current = { stanza: row.stanza, rows: [row] };
      groups.push(current);
    } else if (current) {
      current.rows.push(row);
    }
  }

  // Raw table filtered rows
  const filteredRaw = filterText
    ? rawResults.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(filterText.toLowerCase())))
    : rawResults;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Btool" hideTimePicker />
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar ── */}
        <div className="w-56 shrink-0 border-r border-surface-border flex flex-col overflow-auto">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={13} className="text-emerald-400" />
              <span className="text-xs font-semibold text-white">Commands</span>
            </div>
            {BTOOL_PRESETS.map(group => (
              <div key={group.group} className="mb-3">
                <button
                  onClick={() => setActiveGroup(activeGroup === group.group ? "" : group.group)}
                  className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block hover:text-gray-300 transition-colors w-full text-left"
                >
                  {group.group}
                </button>
                {(activeGroup === group.group || activeGroup === "") && (
                  <div className="flex flex-col gap-0.5">
                    {group.items.map(item => (
                      <button
                        key={item.label}
                        onClick={() => setSpl(item.spl)}
                        className={clsx(
                          "text-left rounded-md px-2 py-1.5 text-[11px] transition-colors",
                          spl === item.spl
                            ? "bg-emerald-500/10 text-emerald-300"
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

        {/* ── Right content ── */}
        <div className="flex-1 overflow-hidden p-5 flex flex-col min-w-0 gap-4">

          {/* SPL input card */}
          <div className="rounded-xl border border-emerald-500/20 bg-surface-raised p-3 shrink-0">
            <div className="flex gap-2">
              <div className="flex-1 flex items-start gap-2">
                <textarea
                  value={spl}
                  onChange={e => setSpl(e.target.value)}
                  rows={2}
                  className="flex-1 rounded-lg border border-emerald-500/30 bg-surface px-3 py-2 text-xs text-emerald-300 font-mono outline-none focus:border-emerald-400/60 resize-y leading-5"
                  spellCheck={false}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runCommand(); } }}
                />
                <CopyButton text={spl} />
              </div>
              <button
                onClick={runCommand}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 self-start"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-600">⌘+Enter to run • Requires Admin's Little Helper app</p>
          </div>

          {error && <ErrorAlert message={error} />}

          {/* Results */}
          {rawResults.length > 0 && !loading && (
            <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden flex-1 flex flex-col min-h-0">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border shrink-0 gap-3">
                <span className="text-[11px] text-gray-500">
                  {isBtoolOutput ? `${groups.length} stanza${groups.length !== 1 ? "s" : ""}` : `${filteredRaw.length} rows`}
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Filter size={11} className="absolute left-2.5 top-[7px] text-gray-500" />
                    <input
                      type="text"
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="Filter…"
                      className="rounded-lg border border-surface-border bg-surface pl-7 pr-2 py-1 text-[11px] text-gray-100 outline-none focus:border-emerald-500/60 w-44"
                    />
                  </div>
                  {isBtoolOutput && (
                    <button
                      onClick={() => setShowRaw(s => !s)}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showRaw ? "Show parsed" : "Show raw"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {/* ── Btool two-column format ── */}
                {isBtoolOutput && !showRaw && (
                  <div className="px-2 py-2">
                    {groups.length === 0 && (
                      <p className="text-[11px] text-gray-500 px-4 py-3">No stanzas match filter.</p>
                    )}
                    {groups.map(group => {
                      const isExpanded = expanded.has(group.stanza);
                      const visible = isExpanded ? group.rows : group.rows.slice(0, PREVIEW_ROWS);
                      const hidden  = group.rows.length - PREVIEW_ROWS;
                      return (
                        <div key={group.stanza} className="px-4 pt-3 pb-2 overflow-x-auto">
                          <div className="font-mono text-xs leading-5">
                            {visible.map((row, i) => (
                              <div key={i} className="flex whitespace-nowrap">
                                <span
                                  className="text-gray-500 shrink-0 w-[520px] pr-8 overflow-hidden"
                                  title={row.file}
                                >
                                  {row.file}
                                </span>
                                <span className={row.isStanza ? "text-emerald-400/80" : "text-gray-100"}>
                                  {row.content}
                                </span>
                              </div>
                            ))}
                          </div>
                          {!isExpanded && hidden > 0 && (
                            <button
                              onClick={() => setExpanded(s => new Set([...s, group.stanza]))}
                              className="mt-1 text-[11px] text-emerald-500 hover:text-emerald-300 transition-colors flex items-center gap-1"
                            >
                              <ChevronDown size={11} /> Show {hidden} more
                            </button>
                          )}
                          {isExpanded && (
                            <button
                              onClick={() => setExpanded(s => { const n = new Set(s); n.delete(group.stanza); return n; })}
                              className="mt-1 text-[11px] text-emerald-500 hover:text-emerald-300 transition-colors flex items-center gap-1"
                            >
                              <ChevronUp size={11} /> Collapse
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Raw table (non-btool output or show raw toggle) ── */}
                {(!isBtoolOutput || showRaw) && (
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-surface-raised z-10">
                      <tr className="border-b border-surface-border">
                        {columns.map(col => (
                          <th key={col} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRaw.map((row, i) => (
                        <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20 transition-colors">
                          {columns.map(col => {
                            const val = String(row[col] ?? "");
                            if (col === "_raw") {
                              return (
                                <td key={col} className="px-3 py-1.5 font-mono text-gray-300 max-w-2xl">
                                  <pre className="text-[11px] whitespace-pre-wrap break-all leading-4">{val}</pre>
                                </td>
                              );
                            }
                            return (
                              <td key={col} className="px-3 py-1.5 font-mono text-gray-300 whitespace-nowrap text-[11px]" title={val}>{val}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-emerald-400" />
              <span className="text-xs text-gray-500">Running command…</span>
            </div>
          )}

          {!loading && rawResults.length === 0 && !error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/10 bg-surface-raised">
              <Terminal size={32} className="text-gray-700" />
              <p className="text-sm text-gray-500">Select a command and hit Run</p>
              <p className="text-[11px] text-gray-600">Requires Admin's Little Helper app</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
