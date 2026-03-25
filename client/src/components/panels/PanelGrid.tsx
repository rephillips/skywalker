import type { PanelConfig } from "../../types/dashboard";
import { DashboardPanel } from "./DashboardPanel";

interface Props {
  panels: PanelConfig[];
  onRemovePanel?: (id: string) => void;
  customPanelIds?: Set<string>;
}

export function PanelGrid({ panels, onRemovePanel, customPanelIds }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4 p-6">
      {panels.map((panel) => {
        const span = Number(panel.span) || 4;
        return (
          <div
            key={panel.id}
            style={{ gridColumn: `span ${span} / span ${span}` }}
          >
            <DashboardPanel
              config={panel}
              onRemove={
                customPanelIds?.has(panel.id) && onRemovePanel
                  ? () => onRemovePanel(panel.id)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
