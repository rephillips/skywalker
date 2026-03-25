import type { PanelConfig } from "../../types/dashboard";
import { DashboardPanel } from "./DashboardPanel";

interface Props {
  panels: PanelConfig[];
}

const spanClass: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

export function PanelGrid({ panels }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {panels.map((panel) => (
        <div key={panel.id} className={spanClass[panel.span ?? 2]}>
          <DashboardPanel config={panel} />
        </div>
      ))}
    </div>
  );
}
