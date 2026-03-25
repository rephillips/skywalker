import { LineChart } from "@tremor/react";
import type { PanelConfig } from "../../types/dashboard";
import type { SplunkResult } from "../../types/splunk";

interface Props {
  config: PanelConfig;
  data: SplunkResult[];
  chartHeight?: number;
}

const NEON_COLORS = ["emerald", "cyan", "fuchsia", "yellow", "rose", "violet"];

export function SwimLanePanel({ config, data, chartHeight = 300 }: Props) {
  const index = config.chartOptions?.index || "_time";
  const allKeys = data.length > 0 ? Object.keys(data[0]) : [];
  const categories = allKeys.filter((k) => k !== index && !k.startsWith("_"));

  if (categories.length === 0) {
    return <p className="text-xs text-gray-500 py-4 text-center">No series found for swimlane</p>;
  }

  // Each category gets its own lane
  const laneHeight = Math.max(100, Math.floor(chartHeight / categories.length) - 8);

  return (
    <div className="flex flex-col gap-2 overflow-auto" style={{ height: chartHeight }}>
      {categories.map((cat, i) => {
        const laneData = data.map((row) => {
          let indexVal: string | number = row[index];
          if (index === "_time" && typeof indexVal === "string") {
            const d = new Date(indexVal);
            indexVal = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          }
          return {
            [index]: indexVal,
            [cat]: Number(row[cat]) || 0,
          };
        });

        return (
          <div key={cat} className="shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: `var(--color-${NEON_COLORS[i % NEON_COLORS.length]}-500, #10b981)` }}
              />
              <span className="text-[11px] font-medium text-gray-400">{cat}</span>
            </div>
            <LineChart
              data={laneData}
              index={index}
              categories={[cat]}
              colors={[NEON_COLORS[i % NEON_COLORS.length]]}
              yAxisWidth={40}
              showAnimation
              showLegend={false}
              style={{ height: laneHeight, width: "100%" }}
            />
          </div>
        );
      })}
    </div>
  );
}
