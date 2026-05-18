import { useState, useRef } from "react";
import { FileText, ExternalLink, Loader2, Search, ChevronDown, Terminal, CornerDownLeft } from "lucide-react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { CopyButton } from "../components/common/CopyButton";

const CONF_FILES = [
  "admon", "alert_actions", "app", "audit", "authentication", "authorize",
  "collections", "commands", "datamodels", "default-mode", "deploymentclient",
  "distsearch", "eventtypes", "fields", "global-banner", "health",
  "indexes", "inputs", "limits", "literals", "macros", "messages",
  "migrations", "outputs", "passwords", "props", "pubsub", "restmap",
  "savedsearches", "server", "serverclass", "source-classifier",
  "sourcetypes", "splunk-launch", "tags", "telemetry", "times",
  "transactiontypes", "transforms", "ui-prefs", "viewstates", "web",
  "workflow_actions",
];

function getDocsUrl(name: string): string {
  const suffix = name.charAt(0).toUpperCase() + name.slice(1) + "conf";
  return `https://docs.splunk.com/Documentation/Splunk/latest/Admin/${suffix}`;
}

interface Stanza {
  name: string;
  attributes: { key: string; value: string }[];
}

function DirectLookup({ confFiles }: { confFiles: string[] }) {
  const [confFile, setConfFile] = useState("");
  const [stanza, setStanza] = useState("");
  const [result, setResult] = useState<{ name: string; attributes: { key: string; value: string }[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const stanzaRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    const file = confFile.trim().replace(/\.conf$/, "");
    const stanzaName = stanza.trim();
    if (!file) return;

    // Single stanza: /configs/conf-{file}/{stanza}
    // All stanzas:   /configs/conf-{file}?count=0
    const path = stanzaName
      ? `configs/conf-${file}/${encodeURIComponent(stanzaName)}`
      : `configs/conf-${file}?count=0`;

    setLoading(true);
    setError(null);
    setResult([]);
    setEndpoint(`/services/${path.replace("?count=0", "")}${stanzaName ? "" : "?count=0&output_mode=json"}`);

    try {
      const res = await api.proxy(path);
      if (res.status === "error") throw new Error(res.message || "Request failed");
      const entries: any[] = res.data?.entry ?? [];
      const parsed = entries.map((entry: any) => {
        const attrs: { key: string; value: string }[] = Object.entries(entry.content ?? {})
          .filter(([k]) => !k.startsWith("eai:"))
          .map(([k, v]) => ({ key: k, value: String(v) }))
          .sort((a, b) => a.key.localeCompare(b.key));
        return { name: entry.name, attributes: attrs };
      });
      setResult(parsed);
      setExpanded(new Set(parsed.map((s) => s.name)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") run();
  };

  const toggleStanza = (name: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  return (
    <div className="mb-6 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
        <Terminal size={14} className="text-brand-400 shrink-0" />
        <span className="text-[10px] text-gray-500 shrink-0">conf file</span>
        <div className="relative">
          <input
            list="conf-files-list"
            value={confFile}
            onChange={(e) => setConfFile(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { stanzaRef.current?.focus(); } if (e.key === "Tab" && !stanza) stanzaRef.current?.focus(); }}
            className="w-36 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-gray-100 font-mono outline-none focus:border-brand-500"
            placeholder="limits"
            autoComplete="off"
          />
          <datalist id="conf-files-list">
            {confFiles.map((f) => <option key={f} value={f} />)}
          </datalist>
        </div>
        <span className="text-gray-600 font-mono text-xs">/</span>
        <span className="text-[10px] text-gray-500 shrink-0">stanza</span>
        <input
          ref={stanzaRef}
          value={stanza}
          onChange={(e) => setStanza(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-40 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-gray-100 font-mono outline-none focus:border-brand-500"
          placeholder="search  (blank = all)"
        />
        <button
          onClick={run}
          disabled={loading || !confFile.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <CornerDownLeft size={12} />}
          Fetch
        </button>
        {endpoint && (
          <div className="flex items-center gap-1.5 ml-2 min-w-0">
            <code className="text-[10px] font-mono text-blue-400/70 truncate">{endpoint}</code>
            <CopyButton text={endpoint} />
          </div>
        )}
      </div>

      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {!error && result.length > 0 && (
        <div className="p-3 flex flex-col gap-2 max-h-[60vh] overflow-auto">
          {result.length > 1 && (
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] text-gray-500">{result.length} stanzas</span>
              <button onClick={() => setExpanded(new Set(result.map(s => s.name)))} className="text-[10px] text-gray-500 hover:text-gray-300">Expand all</button>
              <button onClick={() => setExpanded(new Set())} className="text-[10px] text-gray-500 hover:text-gray-300">Collapse all</button>
            </div>
          )}
          {result.map((stanza) => {
            const isExpanded = expanded.has(stanza.name);
            return (
              <div key={stanza.name} className="rounded-lg border border-surface-border overflow-hidden">
                <button
                  onClick={() => toggleStanza(stanza.name)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
                >
                  <ChevronDown size={11} className={clsx("shrink-0 text-gray-500 transition-transform", isExpanded && "rotate-180")} />
                  <code className="text-sm font-mono text-brand-400">[{stanza.name}]</code>
                  <span className="text-[10px] text-gray-500 ml-auto">{stanza.attributes.length} attrs</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-surface-border">
                    <table className="w-full text-sm">
                      <tbody>
                        {stanza.attributes.map((attr) => (
                          <tr key={attr.key} className="border-b border-surface-border/30 hover:bg-surface-hover/40">
                            <td className="px-3 py-1.5 text-xs font-mono text-emerald-400/80 whitespace-nowrap w-1/3 align-top">{attr.key}</td>
                            <td className="px-3 py-1.5 text-xs font-mono text-gray-300 break-all">
                              {attr.value === "" ? <span className="text-gray-600 italic">empty</span> : attr.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!error && !loading && result.length === 0 && endpoint && (
        <p className="px-4 py-3 text-xs text-gray-500">No results</p>
      )}

      {!endpoint && (
        <p className="px-4 py-3 text-[11px] text-gray-600">
          Type a conf file name and optional stanza, then press Fetch or Enter. Leave stanza blank to load all stanzas (uses <code className="font-mono">count=0</code> — no row limit).
        </p>
      )}
    </div>
  );
}

export function ConfReferencePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [stanzas, setStanzas] = useState<Stanza[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [attrFilter, setAttrFilter] = useState("");
  const [expandedStanzas, setExpandedStanzas] = useState<Set<string>>(new Set());

  async function loadConf(name: string) {
    setSelected(name);
    setLoading(true);
    setError(null);
    setStanzas([]);
    setExpandedStanzas(new Set());
    setAttrFilter("");

    try {
      // Get all stanzas for this conf file
      const res = await api.proxy(`configs/conf-${name}?count=0`);
      if (res.status === "ok" && res.data?.entry) {
        const parsed: Stanza[] = res.data.entry.map((entry: any) => {
          const attrs: { key: string; value: string }[] = [];
          if (entry.content) {
            Object.entries(entry.content).forEach(([k, v]) => {
              if (!k.startsWith("eai:")) {
                attrs.push({ key: k, value: String(v) });
              }
            });
          }
          attrs.sort((a, b) => a.key.localeCompare(b.key));
          return { name: entry.name, attributes: attrs };
        });
        setStanzas(parsed);
        // Auto-expand first stanza
        if (parsed.length > 0) {
          setExpandedStanzas(new Set([parsed[0].name]));
        }
      } else {
        setError(res.message || "Could not fetch configuration");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleStanza(name: string) {
    setExpandedStanzas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filteredConfs = filter
    ? CONF_FILES.filter((f) => f.includes(filter.toLowerCase()))
    : CONF_FILES;

  const lowerAttr = attrFilter.toLowerCase();
  const filteredStanzas = attrFilter
    ? stanzas.filter((s) =>
        s.name.toLowerCase().includes(lowerAttr) ||
        s.attributes.some((a) =>
          a.key.toLowerCase().includes(lowerAttr) ||
          a.value.toLowerCase().includes(lowerAttr)
        )
      )
    : stanzas;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Conf File Reference" />
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 shrink-0 border-r border-surface-border flex flex-col">
          <div className="p-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-gray-500" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface pl-8 pr-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500"
                placeholder="Filter..."
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto px-2 pb-2">
            {filteredConfs.map((name) => (
              <button
                key={name}
                onClick={() => loadConf(name)}
                className={`flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs text-left transition-colors mb-0.5 ${
                  selected === name
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-surface-hover"
                }`}
              >
                <FileText size={12} className="shrink-0" />
                {name}.conf
              </button>
            ))}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-auto p-6">
          <DirectLookup confFiles={CONF_FILES} />
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-12">
              <FileText size={32} className="mb-3 text-gray-600" />
              <p className="text-sm">Select a conf file from the sidebar</p>
              <p className="text-xs text-gray-600 mt-1">Or use the lookup above to jump to a specific file and stanza</p>
            </div>
          ) : (
            <div className="max-w-4xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selected}.conf</h2>
                  <p className="text-xs text-gray-500">
                    {stanzas.length} stanza{stanzas.length !== 1 && "s"} •
                    {" "}{stanzas.reduce((sum, s) => sum + s.attributes.length, 0)} attributes total
                  </p>
                </div>
                <a
                  href={getDocsUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-brand-400 hover:bg-surface-hover transition-colors"
                >
                  <ExternalLink size={12} />
                  Full spec on docs.splunk.com
                </a>
              </div>

              {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-brand-400" />
                </div>
              ) : stanzas.length > 0 ? (
                <>
                  {/* Attribute filter */}
                  <div className="relative mb-4">
                    <Search size={13} className="absolute left-2.5 top-2 text-gray-500" />
                    <input
                      type="text"
                      value={attrFilter}
                      onChange={(e) => setAttrFilter(e.target.value)}
                      className="w-full rounded-lg border border-surface-border bg-surface pl-8 pr-2 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500"
                      placeholder="Search stanzas and attributes..."
                    />
                  </div>

                  {/* Expand/collapse all */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setExpandedStanzas(new Set(filteredStanzas.map((s) => s.name)))}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Expand all
                    </button>
                    <span className="text-[10px] text-gray-600">|</span>
                    <button
                      onClick={() => setExpandedStanzas(new Set())}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Collapse all
                    </button>
                  </div>

                  {/* Stanzas */}
                  <div className="flex flex-col gap-2">
                    {filteredStanzas.map((stanza) => {
                      const isExpanded = expandedStanzas.has(stanza.name);
                      const filteredAttrs = attrFilter
                        ? stanza.attributes.filter((a) =>
                            a.key.toLowerCase().includes(lowerAttr) ||
                            a.value.toLowerCase().includes(lowerAttr)
                          )
                        : stanza.attributes;

                      return (
                        <div key={stanza.name} className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
                          <button
                            onClick={() => toggleStanza(stanza.name)}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-hover transition-colors"
                          >
                            <ChevronDown
                              size={12}
                              className={clsx("shrink-0 text-gray-500 transition-transform", isExpanded && "rotate-180")}
                            />
                            <code className="text-sm font-mono text-brand-400">[{stanza.name}]</code>
                            <span className="text-[10px] text-gray-500 ml-auto">
                              {stanza.attributes.length} attr{stanza.attributes.length !== 1 && "s"}
                            </span>
                          </button>
                          {isExpanded && filteredAttrs.length > 0 && (
                            <div className="border-t border-surface-border">
                              <table className="w-full text-sm">
                                <tbody>
                                  {filteredAttrs.map((attr) => (
                                    <tr key={attr.key} className="border-b border-surface-border/30 hover:bg-surface-hover/50 transition-colors">
                                      <td className="px-4 py-1.5 text-xs font-mono text-emerald-400/80 whitespace-nowrap w-1/3 align-top">
                                        {attr.key}
                                      </td>
                                      <td className="px-4 py-1.5 text-xs font-mono text-gray-300 break-all">
                                        {attr.value === "" ? (
                                          <span className="text-gray-600 italic">empty</span>
                                        ) : attr.value.length > 200 ? (
                                          <details>
                                            <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
                                              {attr.value.slice(0, 100)}...
                                            </summary>
                                            <pre className="mt-1 whitespace-pre-wrap text-[11px]">{attr.value}</pre>
                                          </details>
                                        ) : (
                                          attr.value
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {isExpanded && filteredAttrs.length === 0 && (
                            <p className="px-4 py-2 text-xs text-gray-500 border-t border-surface-border">
                              No attributes match filter
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">No stanzas found</p>
              )}

              {/* REST reference */}
              <div className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-4">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-2">REST Endpoint</span>
                <code className="text-xs font-mono text-blue-400/80">
                  GET /services/configs/conf-{selected}?count=0&output_mode=json
                </code>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  Spec file: $SPLUNK_HOME/etc/system/README/{selected}.conf.spec
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
