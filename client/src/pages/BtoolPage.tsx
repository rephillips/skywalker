import { useState, useCallback } from "react";
import {
  Terminal, Play, Loader2, Filter, ChevronDown, ChevronUp,
  BookOpen, AlertTriangle, List, Layers, Package,
} from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import { parseBtoolRows, type BtoolRow } from "../utils/btool";
import type { SplunkResult } from "../types/splunk";

// ─── Reference data ───────────────────────────────────────────────────────────

const CONF_FILES = [
  "inputs", "props", "transforms", "indexes", "server", "outputs",
  "limits", "authentication", "authorize", "savedsearches", "web",
  "distsearch", "alert_actions", "macros", "tags", "eventtypes",
  "fields", "passwords", "workflow_actions",
];

const REFERENCE = [
  {
    id: "list", icon: List, title: "btool list",
    syntax: "| btool <confname> list [stanza] [flags] splunk_server=local",
    description: "Show the merged configuration for a conf file with source file paths. The primary tool for debugging config precedence across apps and layers.",
    flags: [
      { f: "splunk_server=local", d: "Run on the local search head" },
      { f: "--debug",             d: "Include source file path for each key" },
      { f: "--app=<name>",        d: "Limit to a specific app context" },
      { f: "--allapps",           d: "Show settings per-app individually" },
      { f: "--kvpairs",           d: "Emit each key=value as a separate event" },
      { f: "--user=<name>",       d: "Evaluate in a specific user context" },
    ],
    examples: [
      "| btool distsearch list replicationSettings splunk_server=local",
      "| btool props list --debug splunk_server=local",
      "| btool inputs list monitor:///var/log splunk_server=local",
    ],
  },
  {
    id: "layer", icon: Layers, title: "btool layer",
    syntax: "| btool props layer --sourcetype=<st> [--source=<src>] [--debug] splunk_server=local",
    description: "Show the combined props.conf settings that apply to a specific sourcetype and/or source. Use this to debug field extractions and event processing.",
    flags: [
      { f: "--sourcetype=<st>", d: "Target sourcetype (required)" },
      { f: "--source=<src>",    d: "Target source path (optional)" },
      { f: "--debug",           d: "Include source file paths" },
      { f: "splunk_server=local", d: "Run locally" },
    ],
    examples: [
      '| btool props layer --sourcetype="syslog" --debug splunk_server=local',
      '| btool props layer --sourcetype="syslog" --source="udp:514" --debug splunk_server=local',
    ],
  },
  {
    id: "btoolcheck", icon: AlertTriangle, title: "btoolcheck",
    syntax: "| btoolcheck [app=<app>] [conf=<conf>]",
    description: "Scan all conf files across all apps for errors, typos, and invalid keys. Requires the btoolcheck app. Filter by app or conf type to narrow results.",
    flags: [
      { f: "app=<name>",  d: "Limit to a specific app" },
      { f: "conf=<name>", d: "Limit to a specific conf file" },
    ],
    examples: [
      "| btoolcheck",
      "| btoolcheck app=search",
      "| btoolcheck conf=props",
    ],
  },
  {
    id: "bundlefiles", icon: Package, title: "bundlefiles",
    syntax: "| bundlefiles [bundle=computed|computed_exclusions]",
    description: "List all files in the search head knowledge bundle with sizes and timestamps. Use to audit bundle size, find large lookups, or diagnose replication issues.",
    flags: [
      { f: "bundle=computed",            d: "Computed bundle approximation" },
      { f: "bundle=computed_exclusions", d: "Show denylist exclusions" },
    ],
    examples: [
      "| bundlefiles",
      "| bundlefiles | sort -bytes | head 20",
      "| bundlefiles | search kvstore_collection=*",
    ],
  },
];

// ─── Command builder ──────────────────────────────────────────────────────────

type CmdType = "list" | "layer" | "btoolcheck" | "bundlefiles";

interface BuilderOpts {
  confname: string; stanza: string; debug: boolean; app: string;
  allapps: boolean; kvpairs: boolean; user: string; splunkServer: string;
  sourcetype: string; source: string; btoolApp: string; btoolConf: string; bundleType: string;
}

const DEFAULT_OPTS: BuilderOpts = {
  confname: "distsearch", stanza: "", debug: false, app: "",
  allapps: false, kvpairs: false, user: "", splunkServer: "local",
  sourcetype: "", source: "", btoolApp: "", btoolConf: "", bundleType: "",
};

function buildSpl(type: CmdType, o: BuilderOpts): string {
  switch (type) {
    case "list": {
      const p = [`| btool ${o.confname || "<confname>"} list`];
      if (o.stanza)  p.push(o.stanza);
      if (o.debug)   p.push("--debug");
      if (o.allapps) p.push("--allapps");
      else if (o.app) p.push(`--app=${o.app}`);
      if (o.kvpairs) p.push("--kvpairs");
      if (o.user)    p.push(`--user=${o.user}`);
      p.push(`splunk_server=${o.splunkServer || "local"}`);
      return p.join(" ");
    }
    case "layer": {
      const p = ["| btool props layer"];
      if (o.sourcetype) p.push(`--sourcetype="${o.sourcetype}"`);
      if (o.source)     p.push(`--source="${o.source}"`);
      if (o.debug)      p.push("--debug");
      p.push(`splunk_server=${o.splunkServer || "local"}`);
      return p.join(" ");
    }
    case "btoolcheck": {
      const p = ["| btoolcheck"];
      if (o.btoolApp)  p.push(`app=${o.btoolApp}`);
      if (o.btoolConf) p.push(`conf=${o.btoolConf}`);
      return p.join(" ");
    }
    case "bundlefiles": {
      const p = ["| bundlefiles"];
      if (o.bundleType) p.push(`bundle=${o.bundleType}`);
      return p.join(" ");
    }
  }
}

// ─── Reference card ───────────────────────────────────────────────────────────

function ReferenceCard({ item: r, onExample }: { item: typeof REFERENCE[0]; onExample: (spl: string) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = r.icon;
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-white">{r.title}</span>
        </div>
        {open ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-surface-border/60">
          <code className="block mt-3 mb-2 text-[11px] font-mono text-emerald-300 whitespace-pre-wrap break-all leading-5">{r.syntax}</code>
          <p className="text-[11px] text-gray-400 leading-4 mb-3">{r.description}</p>
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1.5">Flags</div>
            <div className="flex flex-col gap-1">
              {r.flags.map(fl => (
                <div key={fl.f} className="flex gap-2">
                  <code className="text-[10px] font-mono text-emerald-300/80 shrink-0 w-44">{fl.f}</code>
                  <span className="text-[10px] text-gray-500">{fl.d}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1.5">Examples</div>
            <div className="flex flex-col gap-1">
              {r.examples.map(ex => (
                <button key={ex} onClick={() => onExample(ex)}
                  className="text-left group rounded-md px-2 py-1 hover:bg-emerald-500/10 transition-colors"
                  title="Load into builder">
                  <code className="text-[10px] font-mono text-emerald-300 group-hover:text-emerald-200 break-all leading-4">{ex}</code>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div onClick={() => onChange(!checked)}
        className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${checked ? "bg-emerald-500/70" : "bg-surface-border"}`}>
        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${checked ? "translate-x-3" : "translate-x-0"}`} />
      </div>
      <span className="text-[11px] text-gray-400">{label}</span>
    </label>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PREVIEW_ROWS = 25;

export function BtoolPage() {
  const [cmdType, setCmdType]     = useState<CmdType>("list");
  const [opts, setOpts]           = useState<BuilderOpts>(DEFAULT_OPTS);
  const [spl, setSpl]             = useState(() => buildSpl("list", DEFAULT_OPTS));
  const [splEdited, setSplEdited] = useState(false);

  const [rawResults, setRawResults] = useState<SplunkResult[]>([]);
  const [columns, setColumns]       = useState<string[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [showRaw, setShowRaw]       = useState(false);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  function set(k: keyof BuilderOpts, v: any) {
    const next = { ...opts, [k]: v };
    setOpts(next);
    if (!splEdited) setSpl(buildSpl(cmdType, next));
  }

  function switchType(t: CmdType) {
    setCmdType(t);
    setSplEdited(false);
    setSpl(buildSpl(t, opts));
  }

  function loadExample(ex: string) {
    setSpl(ex);
    setSplEdited(true);
  }

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    setShowRaw(false);
    try {
      const res = await api.search(spl);
      const rows = res.results ?? [];
      setRawResults(rows);
      setColumns(rows.length > 0 ? Object.keys(rows[0]).filter(k => !k.startsWith("_") || k === "_raw") : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl]);

  // Parse & group
  const btoolRows   = parseBtoolRows(rawResults);
  const isBtoolOutput = btoolRows.some(r => r.isStanza);

  const filteredRows = filterText
    ? btoolRows.filter(r => r.file.toLowerCase().includes(filterText.toLowerCase()) || r.content.toLowerCase().includes(filterText.toLowerCase()))
    : btoolRows;

  const groups: { stanza: string; rows: BtoolRow[] }[] = [];
  let current: { stanza: string; rows: BtoolRow[] } | null = null;
  for (const row of filteredRows) {
    if (row.isStanza) { current = { stanza: row.stanza, rows: [row] }; groups.push(current); }
    else if (current)  { current.rows.push(row); }
  }

  const filteredRaw = filterText
    ? rawResults.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(filterText.toLowerCase())))
    : rawResults;

  const CMD_TABS: { id: CmdType; label: string }[] = [
    { id: "list",        label: "btool list" },
    { id: "layer",       label: "btool layer" },
    { id: "btoolcheck",  label: "btoolcheck" },
    { id: "bundlefiles", label: "bundlefiles" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title="Btool" hideTimePicker />
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Reference ── */}
        <div className="w-72 shrink-0 border-r border-surface-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <BookOpen size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-white">Command Reference</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {REFERENCE.map(r => (
              <ReferenceCard key={r.id} item={r} onExample={loadExample} />
            ))}
            <div className="rounded-lg border border-surface-border/50 px-3 py-2 mt-1">
              <p className="text-[10px] text-gray-600 leading-4">
                <span className="text-gray-500 font-medium">Requires</span> Admin's Little Helper for{" "}
                <code className="font-mono text-emerald-300/60">btool list</code> /{" "}
                <code className="font-mono text-emerald-300/60">bundlefiles</code>, and the btoolcheck app for{" "}
                <code className="font-mono text-emerald-300/60">btoolcheck</code>.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Builder + Results ── */}
        <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4 min-w-0">

          {/* Builder card */}
          <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-surface-border px-4 pt-3 gap-1 overflow-x-auto">
              {CMD_TABS.map(t => (
                <button key={t.id} onClick={() => switchType(t.id)}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-t-md whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    cmdType === t.id
                      ? "text-emerald-300 border-emerald-400 bg-emerald-500/10"
                      : "text-gray-500 border-transparent hover:text-gray-300"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              <datalist id="conf-files">
                {CONF_FILES.map(c => <option key={c} value={c} />)}
              </datalist>

              {/* Form fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {cmdType === "list" && (<>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">Conf file</label>
                    <input type="text" value={opts.confname} onChange={e => set("confname", e.target.value)}
                      placeholder="e.g. distsearch" list="conf-files"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">Stanza (optional)</label>
                    <input type="text" value={opts.stanza} onChange={e => set("stanza", e.target.value)}
                      placeholder="e.g. replicationSettings"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">splunk_server</label>
                    <input type="text" value={opts.splunkServer} onChange={e => set("splunkServer", e.target.value)}
                      placeholder="local"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">--app= (optional)</label>
                    <input type="text" value={opts.app} onChange={e => set("app", e.target.value)}
                      placeholder="e.g. search"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                </>)}

                {cmdType === "layer" && (<>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">--sourcetype</label>
                    <input type="text" value={opts.sourcetype} onChange={e => set("sourcetype", e.target.value)}
                      placeholder="e.g. syslog"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">--source (optional)</label>
                    <input type="text" value={opts.source} onChange={e => set("source", e.target.value)}
                      placeholder="e.g. udp:514"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">splunk_server</label>
                    <input type="text" value={opts.splunkServer} onChange={e => set("splunkServer", e.target.value)}
                      placeholder="local"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                </>)}

                {cmdType === "btoolcheck" && (<>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">app= (optional)</label>
                    <input type="text" value={opts.btoolApp} onChange={e => set("btoolApp", e.target.value)}
                      placeholder="e.g. search"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">conf= (optional)</label>
                    <input type="text" value={opts.btoolConf} onChange={e => set("btoolConf", e.target.value)}
                      placeholder="e.g. props" list="conf-files"
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60" />
                  </div>
                </>)}

                {cmdType === "bundlefiles" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">Bundle type</label>
                    <select value={opts.bundleType} onChange={e => set("bundleType", e.target.value)}
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60">
                      <option value="">default</option>
                      <option value="computed">computed</option>
                      <option value="computed_exclusions">computed_exclusions</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Toggles */}
              {(cmdType === "list" || cmdType === "layer") && (
                <div className="flex flex-wrap gap-4 mb-4 py-3 border-t border-surface-border/60">
                  <Toggle label="--debug"   checked={opts.debug}   onChange={v => set("debug", v)} />
                  {cmdType === "list" && (<>
                    <Toggle label="--allapps" checked={opts.allapps} onChange={v => set("allapps", v)} />
                    <Toggle label="--kvpairs" checked={opts.kvpairs} onChange={v => set("kvpairs", v)} />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-gray-600">--user=</span>
                      <input type="text" value={opts.user} onChange={e => set("user", e.target.value)}
                        placeholder="optional"
                        className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-[11px] font-mono text-gray-300 outline-none focus:border-emerald-500/60 w-28" />
                    </div>
                  </>)}
                </div>
              )}

              {/* SPL preview */}
              <div className="flex items-start gap-2">
                <div className="flex-1 relative">
                  <textarea value={spl} onChange={e => { setSpl(e.target.value); setSplEdited(true); }}
                    rows={2} spellCheck={false}
                    onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
                    className="w-full rounded-lg border border-emerald-500/30 bg-surface px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-emerald-400/60 resize-none leading-5" />
                  {splEdited && (
                    <button onClick={() => { setSplEdited(false); setSpl(buildSpl(cmdType, opts)); }}
                      className="absolute top-1.5 right-1.5 text-[9px] text-gray-600 hover:text-gray-400 transition-colors">
                      reset
                    </button>
                  )}
                </div>
                <CopyButton text={spl} />
                <button onClick={run} disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 whitespace-nowrap">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Run
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-600">⌘+Enter to run</p>
            </div>
          </div>

          {error && <ErrorAlert message={error} />}

          {/* Results */}
          {rawResults.length > 0 && !loading && (
            <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border shrink-0 gap-3">
                <span className="text-[11px] text-gray-500">
                  {isBtoolOutput ? `${groups.length} stanza${groups.length !== 1 ? "s" : ""}` : `${filteredRaw.length} rows`}
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Filter size={11} className="absolute left-2.5 top-[7px] text-gray-500" />
                    <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
                      placeholder="Filter…"
                      className="rounded-lg border border-surface-border bg-surface pl-7 pr-2 py-1 text-[11px] text-gray-100 outline-none focus:border-emerald-500/60 w-44" />
                  </div>
                  {isBtoolOutput && (
                    <button onClick={() => setShowRaw(s => !s)}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                      {showRaw ? "Show parsed" : "Show raw"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {/* Btool two-column format */}
                {isBtoolOutput && !showRaw && (
                  <div className="px-2 py-2">
                    {groups.length === 0 && <p className="text-[11px] text-gray-500 px-4 py-3">No stanzas match filter.</p>}
                    {groups.map(group => {
                      const isExpanded = expanded.has(group.stanza);
                      const visible = isExpanded ? group.rows : group.rows.slice(0, PREVIEW_ROWS);
                      const hidden  = group.rows.length - PREVIEW_ROWS;
                      return (
                        <div key={group.stanza} className="px-4 pt-3 pb-2 overflow-x-auto">
                          <div className="font-mono text-xs leading-5">
                            {visible.map((row, i) => (
                              <div key={i} className="flex whitespace-nowrap">
                                <span className="text-gray-500 shrink-0 w-[520px] pr-8 overflow-hidden" title={row.file}>
                                  {row.file}
                                </span>
                                <span className={row.isStanza ? "text-emerald-400/80" : "text-gray-100"}>
                                  {row.content}
                                </span>
                              </div>
                            ))}
                          </div>
                          {!isExpanded && hidden > 0 && (
                            <button onClick={() => setExpanded(s => new Set([...s, group.stanza]))}
                              className="mt-1 text-[11px] text-emerald-500 hover:text-emerald-300 transition-colors flex items-center gap-1">
                              <ChevronDown size={11} /> Show {hidden} more
                            </button>
                          )}
                          {isExpanded && (
                            <button onClick={() => setExpanded(s => { const n = new Set(s); n.delete(group.stanza); return n; })}
                              className="mt-1 text-[11px] text-emerald-500 hover:text-emerald-300 transition-colors flex items-center gap-1">
                              <ChevronUp size={11} /> Collapse
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Raw table fallback */}
                {(!isBtoolOutput || showRaw) && (
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-surface-raised z-10">
                      <tr className="border-b border-surface-border">
                        {columns.map(col => (
                          <th key={col} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRaw.map((row, i) => (
                        <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20 transition-colors">
                          {columns.map(col => {
                            const val = String(row[col] ?? "");
                            if (col === "_raw") return (
                              <td key={col} className="px-3 py-1.5 font-mono text-gray-300 max-w-2xl">
                                <pre className="text-[11px] whitespace-pre-wrap break-all leading-4">{val}</pre>
                              </td>
                            );
                            return <td key={col} className="px-3 py-1.5 font-mono text-gray-300 whitespace-nowrap text-[11px]" title={val}>{val}</td>;
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
              <p className="text-sm text-gray-500">Build a command and hit Run</p>
              <p className="text-[11px] text-gray-600">Or click an example in the reference panel →</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
