import { findUserById } from "@/entities/user/repository";
import { listActivityForTask } from "@/entities/activity/repository";
import { describeTaskActivity } from "@/entities/activity/model";
import { getVisibleTask } from "@/features/task/get-task";

export interface TaskChangeStatus {
  taskId: string;
  listId: string;
  changed: boolean;
  latestAt: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  changedFields: string[];
  summary: string | null;
}

export type GetTaskChangeStatusOutcome = { status: "not_found" } | { status: "ok"; changeStatus: TaskChangeStatus };

// Reuses the Activity Log (already written on every task mutation — field
// edits, status changes, rollback, timer actions) as the sole source of
// truth for "did this task change" instead of a second, parallel event
// store. Permission comes from the same getVisibleTask used by GET/PATCH
// /api/tasks/:id and the activity route, so owner/shared-read/shared-edit/
// unrelated-user/deleted-task/revoked-access all resolve identically here.
export function getTaskChangeStatusForUser(
  userId: string,
  taskId: string,
  sinceIso: string,
): GetTaskChangeStatusOutcome {
  const visible = getVisibleTask(userId, taskId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  const sinceMs = new Date(sinceIso).getTime();
  const relevant = listActivityForTask(taskId).filter(
    (activity) => activity.byUserId !== userId && new Date(activity.at).getTime() > sinceMs,
  );

  if (relevant.length === 0) {
    return {
      status: "ok",
      changeStatus: {
        taskId,
        listId: visible.task.listId,
        changed: false,
        latestAt: null,
        actorUserId: null,
        actorEmail: null,
        changedFields: [],
        summary: null,
      },
    };
  }

  const latest = relevant[0];
  const actorEmail = findUserById(latest.byUserId)?.email ?? latest.byUserId;
  const changedFields = [
    ...new Set(relevant.flatMap((activity) => (activity.metadata?.field ? [activity.metadata.field] : []))),
  ];

  return {
    status: "ok",
    changeStatus: {
      taskId,
      listId: visible.task.listId,
      changed: true,
      latestAt: latest.at,
      actorUserId: latest.byUserId,
      actorEmail,
      changedFields,
      summary: describeTaskActivity(latest, actorEmail).summary,
    },
  };
}
