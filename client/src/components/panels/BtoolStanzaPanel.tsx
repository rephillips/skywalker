import { useState, useEffect, useCallback } from "react";
import { FileText, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../../services/api";
import { ErrorAlert } from "../common/ErrorAlert";

interface BtoolRow {
  file: string;
  content: string;
  isStanza: boolean;
  stanza: string;
}

function splitRaw(rawStr: string, splunkBase: string): Array<{ file: string; content: string }> {
  // Case 1: real newlines — each line is unambiguously one btool entry
  const byNewline = rawStr.split(/\r?\n/).map(l => l.trim()).filter(l => /^\S+\.conf\s/.test(l));
  if (byNewline.length > 1) {
    return byNewline.flatMap(line => {
      const m = line.match(/^(\S+\.conf)\s{2,}(.*)/);
      return m ? [{ file: m[1], content: m[2].trim() }] : [];
    });
  }
  // Case 2: concatenated — anchor on detected Splunk base path to avoid
  // false splits inside path-valued attributes (S3 URIs, conf paths, etc.)
  const escaped = splunkBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineRe = new RegExp(`(\\S+\\.conf)\\s{2,}(.*?)(?=${escaped}\\/|$)`, "gs");
  return [...rawStr.matchAll(lineRe)].map(m => ({ file: m[1], content: m[2].trim() }));
}

function parseBtoolRows(results: any[], stanza: string): BtoolRow[] {
  if (!results.length) return [];

  const hasRawPaths = results.some(r => /^\//.test(String(r._raw ?? "").trim()));
  if (!hasRawPaths) return [];

  const firstPath = String(results.find(r => /^\//.test(String(r._raw ?? "").trim()))?._raw ?? "").trim();
  const baseMatch = firstPath.match(/^(\/[^/]+\/[^/]+)\//);
  const splunkBase = baseMatch ? baseMatch[1] : "/opt/splunk";

  const out: BtoolRow[] = [];
  let currentStanza = "";

  for (const row of results) {
    const rawStr = String(row._raw ?? "").trim();
    if (!rawStr.startsWith("/")) continue;
    for (const { file, content } of splitRaw(rawStr, splunkBase)) {
      const isStanza = /^\[.+\]$/.test(content);
      if (isStanza) currentStanza = content.slice(1, -1);
      if (currentStanza !== stanza) continue;
      out.push({ file, content, isStanza, stanza: currentStanza });
    }
  }
  return out;
}

const PREVIEW_ROWS = 20;

interface Props {
  conf: string;           // e.g. "server"
  stanza: string;         // e.g. "shclustering"
  headerLabel: string;    // e.g. "SHC Clustering Config"
  headerKey?: string;     // attribute to show in header after label, e.g. "shcluster_label"
  descriptions?: Record<string, string>;
}

export function BtoolStanzaPanel({ conf, stanza, headerLabel, headerKey, descriptions }: Props) {
  const spl = `| btool ${conf} list ${stanza} splunk_server=local`;

  const [rawRows, setRawRows] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(spl);
      setRawRows(res.results ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl]);

  useEffect(() => { load(); }, [load]);

  const rows = parseBtoolRows(rawRows, stanza);
  const headerValue = headerKey
    ? rows.find(r => r.content.startsWith(`${headerKey} =`))
        ?.content.replace(`${headerKey} =`, "").trim() ?? null
    : null;

  const kvRows = rows.filter(r => !r.isStanza);
  const visible = expanded ? kvRows : kvRows.slice(0, PREVIEW_ROWS);
  const hidden  = kvRows.length - PREVIEW_ROWS;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-brand-400" />
            <h3 className="text-xs font-semibold text-white">
              {headerLabel}
              {headerValue && (
                <span className="text-brand-300 font-mono">: {headerValue}</span>
              )}
            </h3>
          </div>
          <code className="text-[10px] font-mono text-blue-400/60 pl-5">{spl}</code>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {loading && !rawRows.length && (
        <div className="p-6 text-center">
          <Loader2 size={20} className="mx-auto mb-2 text-brand-400 animate-spin" />
          <p className="text-[11px] text-gray-500">Running btool...</p>
        </div>
      )}

      {!loading && !error && rawRows.length === 0 && (
        <div className="p-4 flex items-center gap-2 text-[11px] text-amber-400">
          <AlertTriangle size={13} />
          No results — Admin&apos;s Little Helper app may not be installed on this SH.
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Stanza header row if present */}
          {rows[0]?.isStanza && (
            <div className="px-6 pt-4 pb-1 overflow-x-auto">
              <div className="font-mono text-xs leading-5 flex whitespace-nowrap">
                <span className="text-gray-500 shrink-0 w-[520px] pr-8">{rows[0].file}</span>
                <span className="text-emerald-400/80">{rows[0].content}</span>
              </div>
            </div>
          )}

          {/* Key = value rows */}
          <div className="px-6 pb-3 overflow-x-auto">
            <div className="font-mono text-xs leading-5">
              {visible.map((row, i) => (
                <div key={i} className="flex whitespace-nowrap">
                  <span className="text-gray-400 shrink-0 w-[520px] pr-8">{row.file}</span>
                  <span className={
                    headerKey && row.content.startsWith(`${headerKey} =`)
                      ? "text-brand-300"
                      : "text-gray-100"
                  }>
                    {row.content}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1">
              {!expanded && hidden > 0 && (
                <button onClick={() => setExpanded(true)}
                  className="text-xs text-brand-400 hover:text-brand-200 transition-colors">
                  Show {hidden} more
                </button>
              )}
              {expanded && (
                <button onClick={() => setExpanded(false)}
                  className="text-xs text-brand-400 hover:text-brand-200 transition-colors">
                  Collapse
                </button>
              )}
            </div>
          </div>

          {/* Description for headerKey value */}
          {headerValue && descriptions?.[headerValue] && (
            <div className="px-6 pb-3 text-[11px] text-gray-500">
              {descriptions[headerValue]}
            </div>
          )}


</>
      )}
    </div>
  );
}
