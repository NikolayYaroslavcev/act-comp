import { KANBAN_STATUSES } from "@/entities/task/model";
import type { TaskStatus } from "@/entities/task/schema";

function isKanbanStatus(value: string): value is TaskStatus {
  return (KANBAN_STATUSES as readonly string[]).includes(value);
}

/**
 * Same-column drops (including onto a sibling card) are a no-op: there is
 * no persisted position field, so they must not trigger a PATCH.
 */
export function resolveKanbanDropStatus(
  activeId: string,
  overId: string | null,
  statusById: ReadonlyMap<string, TaskStatus>,
): TaskStatus | null {
  if (overId === null) {
    return null;
  }

  const current = statusById.get(activeId);
  if (current === undefined) {
    return null;
  }

  const next = isKanbanStatus(overId) ? overId : (statusById.get(overId) ?? null);
  if (next === null || next === current) {
    return null;
  }

  return next;
}
