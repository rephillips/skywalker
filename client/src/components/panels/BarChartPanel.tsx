import { BarChart } from "@tremor/react";
import type { PanelConfig } from "../../types/dashboard";
import type { SplunkResult } from "../../types/splunk";

interface Props {
  config: PanelConfig;
  data: SplunkResult[];
}

export function BarChartPanel({ config, data }: Props) {
  const opts = config.chartOptions;
  const index = opts?.index || "_time";
  const allKeys = data.length > 0 ? Object.keys(data[0]) : [];
  const categories = opts?.categories || allKeys.filter((k) => k !== index && k !== "_span" && k !== "_spandays");

  const chartData = data.map((row) => {
    const point: Record<string, string | number> = { [index]: row[index] };
    categories.forEach((cat) => {
      point[cat] = Number(row[cat]) || 0;
    });
    return point;
  });

  return (
    <BarChart
      data={chartData}
      index={index}
      categories={categories}
      colors={opts?.colors || ["indigo", "cyan", "emerald", "amber"]}
      yAxisWidth={48}
      showAnimation
      className="h-full"
    />
  );
}
