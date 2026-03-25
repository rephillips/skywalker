import { TopBar } from "../components/layout/TopBar";
import { PanelGrid } from "../components/panels/PanelGrid";
import { defaultDashboard } from "../config/dashboards";

export function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={defaultDashboard.title} />
      <PanelGrid panels={defaultDashboard.panels} />
    </div>
  );
}
