import type { PanelConfig } from "../../types/dashboard";
import type { SplunkResult } from "../../types/splunk";

interface Props {
  config: PanelConfig;
  data: SplunkResult[];
}

export function KpiCard({ config, data }: Props) {
  const row = data[0];
  if (!row) return null;

  const valueKey = config.chartOptions?.categories?.[0] || Object.keys(row).find((k) => k !== "_time") || Object.keys(row)[0];
  const value = row[valueKey] ?? "—";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-3xl font-bold text-white tracking-tight">
        {config.chartOptions?.valueFormatter
          ? config.chartOptions.valueFormatter(Number(value))
          : Number(value).toLocaleString()}
      </span>
      <span className="text-xs text-gray-500 uppercase tracking-wide">
        {valueKey}
      </span>
    </div>
  );
}
