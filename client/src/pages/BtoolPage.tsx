import { useState, useCallback } from "react";
import {
  Terminal, Play, Loader2, Filter, ChevronDown, ChevronUp,
  BookOpen, AlertTriangle, List, Layers, Search, Package,
} from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";
import type { SplunkResult } from "../types/splunk";

// ─── Reference data ──────────────────────────────────────────────────────────

const CONF_FILES = [
  "inputs", "props", "transforms", "indexes", "server", "outputs",
  "limits", "authentication", "authorize", "savedsearches", "web",
  "distsearch", "alert_actions", "macros", "tags", "eventtypes",
  "fields", "passwords", "workflow_actions",
];

const REFERENCE = [
  {
    id: "list",
    icon: List,
    title: "btool list",
    syntax: "| btool <confname> list [stanza] [flags] splunk_server=local",
    description: "Show the merged configuration for a conf file with source file paths. The primary tool for debugging config precedence across apps and layers.",
    flags: [
      { f: "splunk_server=local", d: "Run on the local search head" },
      { f: "--debug", d: "Include source file path for each key" },
      { f: "--app=<name>", d: "Limit to a specific app context" },
      { f: "--allapps", d: "Show settings per-app individually" },
      { f: "--kvpairs", d: "Emit each key=value as a separate event" },
      { f: "--user=<name>", d: "Evaluate in a specific user context" },
    ],
    examples: [
      "| btool distsearch list replicationSettings splunk_server=local",
      "| btool props list --debug splunk_server=local",
      "| btool inputs list monitor:///var/log splunk_server=local",
    ],
  },
  {
    id: "check",
    icon: Search,
    title: "btool check",
    syntax: "| btool <confname> check [stanza] splunk_server=local",
    description: "Validate conf file settings against the spec file. Reports invalid keys, deprecated settings, and value-type mismatches.",
    flags: [
      { f: "splunk_server=local", d: "Run on the local search head" },
    ],
    examples: [
      "| btool inputs check splunk_server=local",
      "| btool props check splunk_server=local",
      "| btool transforms check splunk_server=local",
    ],
  },
  {
    id: "layer",
    icon: Layers,
    title: "btool layer",
    syntax: "| btool props layer --sourcetype=<st> [--source=<src>] [--debug] splunk_server=local",
    description: "Show the combined props.conf settings that apply to a specific sourcetype and/or source. Use this to debug field extractions and event processing.",
    flags: [
      { f: "--sourcetype=<st>", d: "Target sourcetype (required)" },
      { f: "--source=<src>", d: "Target source path (optional)" },
      { f: "--debug", d: "Include source file paths" },
      { f: "splunk_server=local", d: "Run locally" },
    ],
    examples: [
      '| btool props layer --sourcetype="syslog" --debug splunk_server=local',
      '| btool props layer --sourcetype="syslog" --source="udp:514" --debug splunk_server=local',
    ],
  },
  {
    id: "btoolcheck",
    icon: AlertTriangle,
    title: "btoolcheck",
    syntax: "| btoolcheck [app=<app>] [conf=<conf>]",
    description: "Scan all conf files across all apps for errors, typos, and invalid keys. Requires the btoolcheck app. Filter by app or conf type to narrow results.",
    flags: [
      { f: "app=<name>", d: "Limit to a specific app" },
      { f: "conf=<name>", d: "Limit to a specific conf file" },
    ],
    examples: [
      "| btoolcheck",
      "| btoolcheck app=search",
      "| btoolcheck conf=props",
    ],
  },
  {
    id: "bundlefiles",
    icon: Package,
    title: "bundlefiles",
    syntax: "| bundlefiles [bundle=computed|computed_exclusions]",
    description: "List all files in the search head knowledge bundle with sizes and timestamps. Use to audit bundle size, find large lookups, or diagnose replication issues.",
    flags: [
      { f: "bundle=computed", d: "Computed bundle approximation" },
      { f: "bundle=computed_exclusions", d: "Show denylist exclusions" },
    ],
    examples: [
      "| bundlefiles",
      "| bundlefiles | sort -bytes | head 20",
      "| bundlefiles | search kvstore_collection=*",
    ],
  },
];

// ─── SPL builder ─────────────────────────────────────────────────────────────

type CmdType = "list" | "check" | "layer" | "btoolcheck" | "bundlefiles";

interface BuilderOpts {
  confname: string;
  stanza: string;
  debug: boolean;
  app: string;
  allapps: boolean;
  kvpairs: boolean;
  user: string;
  splunkServer: string;
  sourcetype: string;
  source: string;
  btoolApp: string;
  btoolConf: string;
  bundleType: string;
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
      if (o.stanza) p.push(o.stanza);
      if (o.debug) p.push("--debug");
      if (o.allapps) p.push("--allapps");
      else if (o.app) p.push(`--app=${o.app}`);
      if (o.kvpairs) p.push("--kvpairs");
      if (o.user) p.push(`--user=${o.user}`);
      p.push(`splunk_server=${o.splunkServer || "local"}`);
      return p.join(" ");
    }
    case "check": {
      const p = [`| btool ${o.confname || "<confname>"} check`];
      if (o.stanza) p.push(o.stanza);
      p.push(`splunk_server=${o.splunkServer || "local"}`);
      return p.join(" ");
    }
    case "layer": {
      const p = ["| btool props layer"];
      if (o.sourcetype) p.push(`--sourcetype="${o.sourcetype}"`);
      if (o.source) p.push(`--source="${o.source}"`);
      if (o.debug) p.push("--debug");
      p.push(`splunk_server=${o.splunkServer || "local"}`);
      return p.join(" ");
    }
    case "btoolcheck": {
      const p = ["| btoolcheck"];
      if (o.btoolApp) p.push(`app=${o.btoolApp}`);
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

// ─── Sub-components ──────────────────────────────────────────────────────────

const MESSAGE_COLORS: Record<string, string> = {
  "Invalid key": "text-red-400 bg-red-500/10",
  "Possible typo": "text-amber-400 bg-amber-500/10",
  "No spec file": "text-blue-400 bg-blue-500/10",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, list, mono = true }: {
  value: string; onChange: (v: string) => void; placeholder?: string; list?: string; mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      list={list}
      className={`rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-emerald-500/60 transition-colors ${mono ? "font-mono" : ""}`}
    />
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${checked ? "bg-emerald-500/70" : "bg-surface-border"}`}
      >
        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${checked ? "translate-x-3" : "translate-x-0"}`} />
      </div>
      <span className="text-[11px] text-gray-400">{label}</span>
    </label>
  );
}

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
          {/* Syntax */}
          <code className="block mt-3 mb-2 text-[11px] font-mono text-emerald-300 whitespace-pre-wrap break-all leading-5">
            {r.syntax}
          </code>
          <p className="text-[11px] text-gray-400 leading-4 mb-3">{r.description}</p>

          {/* Flags */}
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

          {/* Examples */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-600 mb-1.5">Examples</div>
            <div className="flex flex-col gap-1">
              {r.examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => onExample(ex)}
                  className="text-left group flex items-start gap-2 rounded-md px-2 py-1 hover:bg-emerald-500/10 transition-colors"
                  title="Load into builder"
                >
                  <code className="text-[10px] font-mono text-emerald-300 group-hover:text-emerald-200 flex-1 break-all leading-4">{ex}</code>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function BtoolPage() {
  const [cmdType, setCmdType]   = useState<CmdType>("list");
  const [opts, setOpts]         = useState<BuilderOpts>(DEFAULT_OPTS);
  const [spl, setSpl]           = useState(() => buildSpl("list", DEFAULT_OPTS));
  const [splEdited, setSplEdited] = useState(false);

  const [results, setResults]   = useState<SplunkResult[]>([]);
  const [columns, setColumns]   = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [excludePath, setExcludePath] = useState("/opt/splunk/etc/system/default/");
  const [excludeEnabled, setExcludeEnabled] = useState(false);

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
    try {
      const res = await api.search(spl);
      const rows = res.results ?? [];
      setResults(rows);
      setColumns(rows.length > 0 ? Object.keys(rows[0]).filter(k => !k.startsWith("_") || k === "_raw") : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl]);

  const filtered = results
    .map(r => {
      if (excludeEnabled && excludePath && r._raw) {
        const kept = r._raw.split("\n").filter((l: string) => l.match(/\[.*\]/) || !l.includes(excludePath));
        if (!kept.length) return null;
        return { ...r, _raw: kept.join("\n") };
      }
      return r;
    })
    .filter((r): r is SplunkResult => {
      if (!r) return false;
      if (!filterText) return true;
      return Object.values(r).some(v => String(v).toLowerCase().includes(filterText.toLowerCase()));
    });

  const CMD_TABS: { id: CmdType; label: string }[] = [
    { id: "list",        label: "btool list" },
    { id: "check",       label: "btool check" },
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
            {/* Requires note */}
            <div className="rounded-lg border border-surface-border/50 px-3 py-2 mt-1">
              <p className="text-[10px] text-gray-600 leading-4">
                <span className="text-gray-500 font-medium">Requires</span> Admin's Little Helper for <code className="font-mono text-emerald-300/60">btool list</code> / <code className="font-mono text-emerald-300/60">bundlefiles</code>, and the btoolcheck app for <code className="font-mono text-emerald-300/60">btoolcheck</code>.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Builder + Results ── */}
        <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4 min-w-0">

          {/* Builder card */}
          <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden shrink-0">
            {/* Command type tabs */}
            <div className="flex border-b border-surface-border px-4 pt-3 gap-1 overflow-x-auto">
              {CMD_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => switchType(t.id)}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-t-md whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    cmdType === t.id
                      ? "text-emerald-300 border-emerald-400 bg-emerald-500/10"
                      : "text-gray-500 border-transparent hover:text-gray-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* Datalist for conf file autocomplete */}
              <datalist id="conf-files">
                {CONF_FILES.map(c => <option key={c} value={c} />)}
              </datalist>

              {/* Form fields by command type */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {(cmdType === "list" || cmdType === "check") && (<>
                  <Field label="Conf file">
                    <TextInput value={opts.confname} onChange={v => set("confname", v)} placeholder="e.g. distsearch" list="conf-files" />
                  </Field>
                  <Field label="Stanza (optional)">
                    <TextInput value={opts.stanza} onChange={v => set("stanza", v)} placeholder="e.g. replicationSettings" />
                  </Field>
                  <Field label="splunk_server">
                    <TextInput value={opts.splunkServer} onChange={v => set("splunkServer", v)} placeholder="local" />
                  </Field>
                  {cmdType === "list" && (
                    <Field label="--app= (optional)">
                      <TextInput value={opts.app} onChange={v => set("app", v)} placeholder="e.g. search" />
                    </Field>
                  )}
                </>)}

                {cmdType === "layer" && (<>
                  <Field label="--sourcetype">
                    <TextInput value={opts.sourcetype} onChange={v => set("sourcetype", v)} placeholder="e.g. syslog" />
                  </Field>
                  <Field label="--source (optional)">
                    <TextInput value={opts.source} onChange={v => set("source", v)} placeholder="e.g. udp:514" />
                  </Field>
                  <Field label="splunk_server">
                    <TextInput value={opts.splunkServer} onChange={v => set("splunkServer", v)} placeholder="local" />
                  </Field>
                </>)}

                {cmdType === "btoolcheck" && (<>
                  <Field label="app= (optional)">
                    <TextInput value={opts.btoolApp} onChange={v => set("btoolApp", v)} placeholder="e.g. search" />
                  </Field>
                  <Field label="conf= (optional)">
                    <TextInput value={opts.btoolConf} onChange={v => set("btoolConf", v)} placeholder="e.g. props" list="conf-files" />
                  </Field>
                </>)}

                {cmdType === "bundlefiles" && (
                  <Field label="bundle type">
                    <select
                      value={opts.bundleType}
                      onChange={e => set("bundleType", e.target.value)}
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 font-mono outline-none focus:border-emerald-500/60"
                    >
                      <option value="">default</option>
                      <option value="computed">computed</option>
                      <option value="computed_exclusions">computed_exclusions</option>
                    </select>
                  </Field>
                )}
              </div>

              {/* Toggles */}
              {(cmdType === "list" || cmdType === "layer") && (
                <div className="flex flex-wrap gap-4 mb-4 py-3 border-t border-surface-border/60">
                  {cmdType === "list" && (<>
                    <Toggle label="--debug" checked={opts.debug} onChange={v => set("debug", v)} />
                    <Toggle label="--allapps" checked={opts.allapps} onChange={v => set("allapps", v)} />
                    <Toggle label="--kvpairs" checked={opts.kvpairs} onChange={v => set("kvpairs", v)} />
                  </>)}
                  {cmdType === "layer" && (
                    <Toggle label="--debug" checked={opts.debug} onChange={v => set("debug", v)} />
                  )}
                  {(cmdType === "list") && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-gray-600">--user=</span>
                      <input
                        type="text"
                        value={opts.user}
                        onChange={e => set("user", e.target.value)}
                        placeholder="optional"
                        className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-[11px] text-gray-300 font-mono outline-none focus:border-emerald-500/60 w-28"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Generated SPL */}
              <div className="flex items-start gap-2">
                <div className="flex-1 relative">
                  <textarea
                    value={spl}
                    onChange={e => { setSpl(e.target.value); setSplEdited(true); }}
                    rows={2}
                    spellCheck={false}
                    onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
                    className="w-full rounded-lg border border-emerald-500/30 bg-surface px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-emerald-400/60 resize-none leading-5"
                  />
                  {splEdited && (
                    <button
                      onClick={() => { setSplEdited(false); setSpl(buildSpl(cmdType, opts)); }}
                      className="absolute top-1.5 right-1.5 text-[9px] text-gray-600 hover:text-gray-400 transition-colors"
                    >reset</button>
                  )}
                </div>
                <CopyButton text={spl} />
                <button
                  onClick={run}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Run
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-600">⌘+Enter to run</p>
            </div>
          </div>

          {/* Error */}
          {error && <ErrorAlert message={error} />}

          {/* Results */}
          {(results.length > 0 || loading) && (
            <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden">
              {/* Results toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border shrink-0 gap-3">
                <span className="text-[11px] text-gray-400">
                  {loading ? "Running…" : `${filtered.length}${filtered.length !== results.length ? ` of ${results.length}` : ""} results`}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter */}
                  <div className="relative">
                    <Filter size={11} className="absolute left-2.5 top-[7px] text-gray-500" />
                    <input
                      type="text"
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="Filter…"
                      className="rounded-lg border border-surface-border bg-surface pl-7 pr-2 py-1 text-[11px] text-gray-100 outline-none focus:border-emerald-500/60 w-40"
                    />
                  </div>
                  {/* Exclude path */}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeEnabled}
                      onChange={e => setExcludeEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-[10px] text-gray-500">Exclude:</span>
                  </label>
                  <input
                    type="text"
                    value={excludePath}
                    onChange={e => setExcludePath(e.target.value)}
                    className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-[10px] font-mono text-gray-400 outline-none focus:border-emerald-500/60 w-64"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-emerald-400" />
                  <span className="text-xs text-gray-500">Running command…</span>
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
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
                      {filtered.map((row, i) => (
                        <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20 transition-colors">
                          {columns.map(col => {
                            const raw = String(row[col] ?? "");
                            if (col === "message_type" && MESSAGE_COLORS[raw]) {
                              return (
                                <td key={col} className="px-3 py-1.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${MESSAGE_COLORS[raw]}`}>{raw}</span>
                                </td>
                              );
                            }
                            if (col === "_raw") {
                              return (
                                <td key={col} className="px-3 py-1.5 font-mono text-gray-300 max-w-2xl">
                                  <pre className="text-[11px] whitespace-pre-wrap break-all leading-4">{raw}</pre>
                                </td>
                              );
                            }
                            return (
                              <td key={col} className="px-3 py-1.5 font-mono text-gray-300 whitespace-nowrap" title={raw}>{raw}</td>
                            );
                          })}
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={columns.length} className="px-3 py-6 text-center text-[11px] text-gray-500">
                            No rows match filter
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && results.length === 0 && !error && (
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
