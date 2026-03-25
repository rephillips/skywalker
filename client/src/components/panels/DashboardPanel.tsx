import { RefreshCw, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { PanelConfig } from "../../types/dashboard";
import { useSplunkSearch } from "../../hooks/useSplunkSearch";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { ErrorAlert } from "../common/ErrorAlert";
import { LineChartPanel } from "./LineChartPanel";
import { BarChartPanel } from "./BarChartPanel";
import { KpiCard } from "./KpiCard";
import { TablePanel } from "./TablePanel";

interface Props {
  config: PanelConfig;
  onRemove?: () => void;
}

const heightMap = {
  sm: "min-h-[160px]",
  md: "min-h-[280px]",
  lg: "min-h-[400px]",
};

export function DashboardPanel({ config, onRemove }: Props) {
  const { data, loading, error, refetch } = useSplunkSearch(config.spl, {
    earliest: config.earliest,
    latest: config.latest,
    refreshInterval: config.refreshInterval,
  });

  const height = heightMap[config.height || "md"];

  return (
    <div
      className={clsx(
        "rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col",
        height
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">{config.title}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={refetch}
            className="rounded-md p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="rounded-md p-1 text-gray-500 hover:text-red-400 hover:bg-surface-hover transition-colors"
              title="Remove panel"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading && !data ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : data && data.length > 0 ? (
          <VizSwitch config={config} data={data} />
        ) : data && data.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No results returned</p>
        ) : null}
      </div>
    </div>
  );
}

function VizSwitch({
  config,
  data,
}: {
  config: PanelConfig;
  data: NonNullable<ReturnType<typeof useSplunkSearch>["data"]>;
}) {
  switch (config.vizType) {
    case "line":
    case "area":
      return <LineChartPanel config={config} data={data} />;
    case "bar":
      return <BarChartPanel config={config} data={data} />;
    case "kpi":
      return <KpiCard config={config} data={data} />;
    case "table":
      return <TablePanel config={config} data={data} />;
    default:
      return <p className="text-sm text-gray-500">Unknown viz type: {config.vizType}</p>;
  }
}
