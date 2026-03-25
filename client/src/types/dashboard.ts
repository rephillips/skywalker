export type VizType = "line" | "bar" | "area" | "kpi" | "table" | "donut";

export interface ChartOptions {
  index?: string;
  categories?: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
}

export interface PanelConfig {
  id: string;
  title: string;
  spl: string;
  vizType: VizType;
  earliest?: string;
  latest?: string;
  refreshInterval?: number;
  span?: 1 | 2 | 3 | 4;
  height?: "sm" | "md" | "lg";
  chartOptions?: ChartOptions;
}

export interface DashboardConfig {
  id: string;
  title: string;
  panels: PanelConfig[];
}
