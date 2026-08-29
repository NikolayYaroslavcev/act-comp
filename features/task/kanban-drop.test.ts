import { describe, expect, it } from "vitest";
import { resolveKanbanDropStatus } from "@/features/task/kanban-drop";
import type { TaskStatus } from "@/entities/task/schema";

function statuses(entries: Array<[string, TaskStatus]>): ReadonlyMap<string, TaskStatus> {
  return new Map(entries);
}

describe("resolveKanbanDropStatus", () => {
  it("returns the column status when dropping onto a column", () => {
    expect(resolveKanbanDropStatus("t1", "in_progress", statuses([["t1", "new"]]))).toBe("in_progress");
  });

  it("returns the target card's status when dropping onto another card", () => {
    expect(
      resolveKanbanDropStatus(
        "t1",
        "t2",
        statuses([
          ["t1", "new"],
          ["t2", "done"],
        ]),
      ),
    ).toBe("done");
  });

  it("returns null for a same-column drop onto the column", () => {
    expect(resolveKanbanDropStatus("t1", "new", statuses([["t1", "new"]]))).toBeNull();
  });

  it("returns null for a same-column drop onto a sibling card", () => {
    expect(
      resolveKanbanDropStatus(
        "t1",
        "t2",
        statuses([
          ["t1", "new"],
          ["t2", "new"],
        ]),
      ),
    ).toBeNull();
  });

  it("returns null when there is no drop target", () => {
    expect(resolveKanbanDropStatus("t1", null, statuses([["t1", "new"]]))).toBeNull();
  });
});
