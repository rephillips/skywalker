import type { PanelConfig } from "../../types/dashboard";
import type { SplunkResult } from "../../types/splunk";

interface Props {
  config: PanelConfig;
  data: SplunkResult[];
}

export function TablePanel({ config, data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">No results</p>;
  }

  const columns = Object.keys(data[0]).filter(
    (k) => !k.startsWith("_") || k === "_time" || k === "_raw"
  );

  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors"
            >
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-gray-300 truncate max-w-xs">
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
