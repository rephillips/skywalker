import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PanelConfig } from "../../types/dashboard";
import { DashboardPanel } from "./DashboardPanel";

interface Props {
  panels: PanelConfig[];
  onRemovePanel?: (id: string) => void;
  onUpdatePanel?: (id: string, updates: Partial<PanelConfig>) => void;
  onReorder?: (activeId: string, overId: string) => void;
  customPanelIds?: Set<string>;
}

function SortablePanel({
  panel,
  onRemove,
  onUpdate,
}: {
  panel: PanelConfig;
  onRemove?: () => void;
  onUpdate?: (updates: Partial<PanelConfig>) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: panel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <DashboardPanel
        config={panel}
        onRemove={onRemove}
        onUpdate={onUpdate}
        dragHandleProps={listeners}
      />
    </div>
  );
}

export function PanelGrid({ panels, onRemovePanel, onUpdatePanel, onReorder, customPanelIds }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id && onReorder) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={panels.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap items-start gap-4 p-6">
          {panels.map((panel) => (
            <SortablePanel
              key={panel.id}
              panel={panel}
              onRemove={
                customPanelIds?.has(panel.id) && onRemovePanel
                  ? () => onRemovePanel(panel.id)
                  : undefined
              }
              onUpdate={
                customPanelIds?.has(panel.id) && onUpdatePanel
                  ? (updates) => onUpdatePanel(panel.id, updates)
                  : undefined
              }
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
