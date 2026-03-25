import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Search, Code } from "lucide-react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { apiCategories, apiConventions, type Endpoint } from "../config/apiReference";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400",
  POST: "bg-blue-500/15 text-blue-400",
  DELETE: "bg-red-500/15 text-red-400",
};

function EndpointRow({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  const hasExample = !!ep.example;

  return (
    <>
      <tr
        onClick={() => hasExample && setOpen(!open)}
        className={clsx(
          "border-t border-surface-border/50 transition-colors",
          hasExample
            ? "hover:bg-surface-hover cursor-pointer"
            : "hover:bg-surface-hover/50"
        )}
      >
        <td className="px-5 py-2 font-mono text-xs text-gray-200 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {hasExample && (
              <ChevronRight
                size={12}
                className={clsx(
                  "shrink-0 text-gray-500 transition-transform",
                  open && "rotate-90"
                )}
              />
            )}
            {!hasExample && <span className="w-3" />}
            {ep.path}
          </div>
        </td>
        <td className="px-2 py-2">
          <div className="flex gap-1">
            {ep.methods.split(", ").map((m) => (
              <span
                key={m}
                className={clsx(
                  "rounded px-1.5 py-0.5 text-[10px] font-mono font-bold",
                  METHOD_COLORS[m] || "bg-gray-500/15 text-gray-400"
                )}
              >
                {m}
              </span>
            ))}
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="flex-1">{ep.description}</span>
            {hasExample && (
              <Code size={12} className="shrink-0 text-brand-400 opacity-60" />
            )}
          </div>
        </td>
      </tr>
      {open && ep.example && (
        <tr>
          <td colSpan={3} className="px-5 pb-3">
            <div className="ml-4 mt-1 rounded-lg border border-surface-border bg-surface p-3 space-y-2">
              {/* Request */}
              <div>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                  Request
                </span>
                <pre className="mt-1 text-xs font-mono text-emerald-400/90 whitespace-pre-wrap break-all leading-relaxed">
                  {ep.example.request}
                </pre>
              </div>
              {/* Response */}
              {ep.example.response && (
                <div>
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                    Response
                  </span>
                  <pre className="mt-1 text-xs font-mono text-blue-400/80 whitespace-pre-wrap break-all leading-relaxed">
                    {ep.example.response}
                  </pre>
                </div>
              )}
              {/* Notes */}
              {ep.example.notes && (
                <p className="text-[11px] text-gray-500 italic">
                  {ep.example.notes}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function DocsPage() {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(apiCategories.map((c) => c.id))
  );

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const lowerSearch = search.toLowerCase();

  const filteredCategories = apiCategories
    .map((cat) => {
      if (!search) return cat;
      const filteredSubs = cat.subSections
        .map((sub) => ({
          ...sub,
          endpoints: sub.endpoints.filter(
            (ep) =>
              ep.path.toLowerCase().includes(lowerSearch) ||
              ep.description.toLowerCase().includes(lowerSearch) ||
              ep.methods.toLowerCase().includes(lowerSearch)
          ),
        }))
        .filter((sub) => sub.endpoints.length > 0);

      if (
        filteredSubs.length > 0 ||
        cat.name.toLowerCase().includes(lowerSearch)
      ) {
        return { ...cat, subSections: filteredSubs };
      }
      return null;
    })
    .filter(Boolean) as typeof apiCategories;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="API Reference" />

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">
              Splunk REST API Reference
            </h2>
            <p className="text-sm text-gray-500">
              v10.0 — ~265 endpoints across 16 categories.{" "}
              <a
                href="https://help.splunk.com/en/splunk-enterprise/rest-api-reference/10.0/introduction/using-the-rest-api-reference"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 hover:text-brand-50 inline-flex items-center gap-1"
              >
                Official docs <ExternalLink size={12} />
              </a>
            </p>
          </div>

          {/* Search filter */}
          <div className="relative mb-6">
            <Search
              size={16}
              className="absolute left-3 top-2.5 text-gray-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface pl-9 pr-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500 transition-colors"
              placeholder="Filter endpoints... e.g. search/v2, auth, saved"
            />
          </div>

          {/* Conventions summary */}
          {!search && (
            <div className="rounded-xl border border-surface-border bg-surface-raised p-5 mb-6">
              <h3 className="text-sm font-semibold text-white mb-3">
                API Conventions
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 uppercase tracking-wide block mb-1.5">
                    Base URL
                  </span>
                  {apiConventions.baseUrl.map((u) => (
                    <code
                      key={u}
                      className="block text-gray-300 font-mono mb-1"
                    >
                      {u}
                    </code>
                  ))}
                </div>
                <div>
                  <span className="text-gray-500 uppercase tracking-wide block mb-1.5">
                    Auth Methods
                  </span>
                  {apiConventions.authMethods.map((a) => (
                    <div key={a.method} className="mb-1">
                      <span className="text-gray-200 font-medium">
                        {a.method}
                      </span>{" "}
                      <span className="text-gray-500">— {a.detail}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <span className="text-gray-500 uppercase tracking-wide block mb-1.5">
                    HTTP Methods
                  </span>
                  <div className="flex gap-2">
                    {apiConventions.httpMethods.map((m) => (
                      <span
                        key={m.method}
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[11px] font-mono font-bold",
                          METHOD_COLORS[m.method]
                        )}
                      >
                        {m.method}
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-500 mt-1">
                    PUT is NOT supported. Use POST for updates.
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 uppercase tracking-wide block mb-1.5">
                    Common Params
                  </span>
                  {apiConventions.queryParams.slice(0, 4).map((p) => (
                    <div key={p.param} className="mb-0.5">
                      <code className="text-gray-300 font-mono">
                        {p.param}
                      </code>{" "}
                      <span className="text-gray-500">
                        — {p.description} (default: {p.default})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category list */}
          <div className="flex flex-col gap-3">
            {filteredCategories.map((cat) => {
              const isExpanded = expandedCategories.has(cat.id) || !!search;
              const totalEndpoints = cat.subSections.reduce(
                (sum, s) => sum + s.endpoints.length,
                0
              );

              return (
                <div
                  key={cat.id}
                  className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden"
                >
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-hover transition-colors"
                  >
                    <ChevronDown
                      size={14}
                      className={clsx(
                        "shrink-0 text-gray-500 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-white">
                        {cat.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {totalEndpoints} endpoint
                        {totalEndpoints !== 1 && "s"}
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-surface-border">
                      <p className="px-5 py-2 text-xs text-gray-500">
                        {cat.description}
                      </p>
                      {cat.subSections.map((sub) => (
                        <div key={sub.name}>
                          <div className="px-5 py-1.5">
                            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                              {sub.name}
                            </span>
                          </div>
                          <table className="w-full text-sm mb-2">
                            <tbody>
                              {sub.endpoints.map((ep) => (
                                <EndpointRow key={ep.path} ep={ep} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-500">
              No endpoints match "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
