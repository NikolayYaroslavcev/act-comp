import { applyTaskQuery, type TaskFilters } from "@/entities/task/model";
import type { TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import type { Task } from "@/entities/task/schema";

function criteriaToTaskFilters(criteria: TaskFilterCriteria): TaskFilters {
  return {
    status: criteria.status,
    category: criteria.category ?? undefined,
    tags: criteria.tags,
    priorityMin: criteria.priorityMin ?? undefined,
    priorityMax: criteria.priorityMax ?? undefined,
    deadlineFrom: criteria.deadlineFrom ?? undefined,
    deadlineTo: criteria.deadlineTo ?? undefined,
  };
}

export function applyExportQuery(tasks: Task[], criteria: TaskFilterCriteria): Task[] {
  return applyTaskQuery(tasks, { search: criteria.search, filters: criteriaToTaskFilters(criteria) });
}
