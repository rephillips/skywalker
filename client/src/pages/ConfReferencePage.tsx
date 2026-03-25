import { useState } from "react";
import { FileText, ExternalLink, Loader2, Search } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";

const CONF_FILES = [
  "inputs", "outputs", "props", "transforms", "server", "indexes",
  "limits", "savedsearches", "authentication", "authorize",
  "alert_actions", "app", "collections", "commands", "datamodels",
  "deploymentclient", "distsearch", "eventtypes", "fields", "health",
  "macros", "web", "serverclass", "tags", "times", "transactiontypes",
  "workflow_actions", "ui-prefs", "restmap", "passwords", "audit",
  "source-classifier", "default-mode", "migrations", "pubsub",
  "global-banner", "telemetry", "viewstates", "literals", "messages",
  "admon", "splunk-launch", "sourcetypes",
];

function getDocsUrl(name: string): string {
  const suffix = name.charAt(0).toUpperCase() + name.slice(1) + "conf";
  return `https://docs.splunk.com/Documentation/Splunk/latest/Admin/${suffix}`;
}

export function ConfReferencePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [specContent, setSpecContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function loadSpec(name: string) {
    setSelected(name);
    setLoading(true);
    setError(null);
    setSpecContent(null);
    try {
      // Try fetching the spec content via SPL
      const res = await api.search(
        `| rest splunk_server=local /services/configs/conf-${name} | head 1 | fields title`
      );

      // Also try to get the actual spec file content via REST
      const specRes = await api.proxy(`properties/${name}`);
      if (specRes.status === "ok" && specRes.data?.entry) {
        const stanzas = specRes.data.entry.map((e: any) => {
          const name = e.name;
          const keys = e.content
            ? Object.entries(e.content)
                .filter(([k]) => !k.startsWith("eai:"))
                .map(([k, v]) => `${k} = ${v}`)
                .join("\n")
            : "";
          return `[${name}]\n${keys}`;
        }).join("\n\n");
        setSpecContent(stanzas || "No stanzas found in this configuration.");
      } else {
        // Fallback: show the docs link
        setSpecContent(`Could not fetch local spec. View online:\n${getDocsUrl(name)}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter
    ? CONF_FILES.filter((f) => f.includes(filter.toLowerCase()))
    : CONF_FILES;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Conf File Reference" />
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - conf file list */}
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
            {filtered.map((name) => (
              <button
                key={name}
                onClick={() => loadSpec(name)}
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

        {/* Right content - spec viewer */}
        <div className="flex-1 overflow-auto p-6">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 py-20">
              <FileText size={32} className="mb-3 text-gray-600" />
              <p className="text-sm">Select a conf file from the list</p>
              <p className="text-xs text-gray-600 mt-1">View stanzas, settings, and link to official docs</p>
            </div>
          ) : (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selected}.conf</h2>
                  <p className="text-xs text-gray-500">Configuration file specification</p>
                </div>
                <a
                  href={getDocsUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-brand-400 hover:bg-surface-hover transition-colors"
                >
                  <ExternalLink size={12} />
                  View on docs.splunk.com
                </a>
              </div>

              {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-brand-400" />
                </div>
              ) : specContent ? (
                <div className="rounded-xl border border-surface-border bg-surface p-4">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-2">
                    Current Configuration (from your Splunk instance)
                  </span>
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[calc(100vh-250px)] overflow-auto">
                    {specContent}
                  </pre>
                </div>
              ) : null}

              {/* REST reference */}
              <div className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-4">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-2">REST Endpoint</span>
                <code className="text-xs font-mono text-blue-400/80">
                  GET /services/properties/{selected}?output_mode=json
                </code>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  Spec file location: $SPLUNK_HOME/etc/system/README/{selected}.conf.spec
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
