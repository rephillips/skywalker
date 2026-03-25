import { useRef, useState, useEffect } from "react";
import { LineChart } from "@tremor/react";
import type { PanelConfig } from "../../types/dashboard";
import type { SplunkResult } from "../../types/splunk";

interface Props {
  config: PanelConfig;
  data: SplunkResult[];
}

const NEON_COLORS = ["emerald", "cyan", "fuchsia", "yellow", "rose", "violet"];

export function LineChartPanel({ config, data }: Props) {
  const opts = config.chartOptions;
  const index = opts?.index || "_time";
  const allKeys = data.length > 0 ? Object.keys(data[0]) : [];
  const categories = opts?.categories || allKeys.filter(
    (k) => k !== index && !k.startsWith("_")
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(250);

  useEffect(() => {
    if (containerRef.current) {
      const h = containerRef.current.offsetHeight;
      if (h > 50) setChartHeight(h);
    }
  });

  const chartData = data.map((row) => {
    const point: Record<string, string | number> = { [index]: row[index] };
    categories.forEach((cat) => {
      point[cat] = Number(row[cat]) || 0;
    });
    return point;
  });

  if (categories.length === 0) {
    return (
      <div className="text-xs text-gray-500 py-4">
        <p>No chart categories found. Fields: {allKeys.join(", ")}</p>
        <p className="mt-1 font-mono text-[10px] text-gray-600">
          Sample: {JSON.stringify(data[0]).slice(0, 300)}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <LineChart
        data={chartData}
        index={index}
        categories={categories}
        colors={NEON_COLORS.slice(0, categories.length)}
        yAxisWidth={48}
        showAnimation
        showLegend
        style={{ height: chartHeight }}
      />
    </div>
  );
}
