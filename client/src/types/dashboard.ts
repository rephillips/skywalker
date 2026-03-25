export type VizType = "line" | "bar" | "area" | "kpi" | "table" | "donut" | "swimlane" | "overlay";

export interface StatusDot {
  id: string;
  label: string;
  spl: string;
  thresholds: { green: number; yellow: number; orange: number };
}

export interface OverlaySearch {
  id: string;
  label: string;
  spl: string;
  color?: string;
}

export interface ChartOptions {
  index?: string;
  categories?: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  statusDots?: StatusDot[];
  overlaySearches?: OverlaySearch[];
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
  pixelHeight?: number;
  pixelWidth?: number;
  chartOptions?: ChartOptions;
  statusIndicator?: {
    spl: string;
    thresholds: { green: number; yellow: number; orange: number };
  };
}

export interface DashboardConfig {
  id: string;
  title: string;
  panels: PanelConfig[];
}
