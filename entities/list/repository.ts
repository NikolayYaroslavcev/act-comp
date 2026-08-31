import { getDb, saveDb } from "@/shared/lib/db";
import type { TaskList } from "@/entities/list/schema";
import type { CreateListInput, DuplicateListInput, ShareListInput, UpdateListInput } from "@/entities/list/requests";
import {
  applyListShare,
  buildDuplicatedList,
  buildListDeletionHistoryEntry,
  buildListRestorationHistoryEntry,
  canDeleteList,
  canEditList,
  canManageListSharing,
  canRestoreList,
  canViewList,
  diffListChanges,
} from "@/entities/list/model";
import { buildDuplicatedTasks } from "@/entities/task/model";
import { insertTasks, listTasks } from "@/entities/task/repository";
import { findUserByEmail, findUserById } from "@/entities/user/repository";

export async function listLists(): Promise<TaskList[]> {
  return Object.values((await getDb()).lists);
}

export async function findListById(id: string): Promise<TaskList | undefined> {
  return (await getDb()).lists[id];
}

export async function createList(ownerId: string, input: CreateListInput): Promise<TaskList> {
  const db = await getDb();
  const now = new Date().toISOString();
  const list: TaskList = {
    id: crypto.randomUUID(),
    ownerId,
    title: input.title,
    template: input.template,
    taskIds: [],
    deadline: input.deadline ?? null,
    sharedWith: [],
    history: [],
    deletedAt: null,
    lastActivityAt: now,
  };
  db.lists[list.id] = list;
  await saveDb(db);
  return list;
}

export type UpdateListOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "deleted" }
  | { status: "ok"; list: TaskList };

export async function updateList(id: string, userId: string, patch: UpdateListInput): Promise<UpdateListOutcome> {
  const db = await getDb();
  const existing = db.lists[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (!canViewList(existing, userId)) {
    return { status: "not_found" };
  }

  if (!canEditList(existing, userId)) {
    return { status: "forbidden" };
  }

  if (existing.deletedAt !== null) {
    return { status: "deleted" };
  }

  const now = new Date().toISOString();
  const changes = diffListChanges(existing, patch, userId, now);
  if (changes.length === 0) {
    return { status: "ok", list: existing };
  }

  const updated: TaskList = {
    ...existing,
    ...patch,
    history: [...existing.history, ...changes],
    lastActivityAt: now,
  };
  db.lists[id] = updated;
  await saveDb(db);
  return { status: "ok", list: updated };
}

export type DuplicateListOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "deleted" }
  | { status: "ok"; list: TaskList };

export async function duplicateList(id: string, userId: string, input: DuplicateListInput): Promise<DuplicateListOutcome> {
  const db = await getDb();
  const existing = db.lists[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (!canViewList(existing, userId)) {
    return { status: "not_found" };
  }

  if (existing.deletedAt !== null) {
    return { status: "deleted" };
  }

  const now = new Date().toISOString();
  const newListId = crypto.randomUUID();

  let taskIds: string[] = [];
  if (input.copyTasks) {
    const duplicatedTasks = buildDuplicatedTasks(await listTasks(existing.id, db), newListId, now, () => crypto.randomUUID());
    await insertTasks(duplicatedTasks, db);
    taskIds = duplicatedTasks.map((task) => task.id);
  }

  const sharedWith = input.copySharedWith ? existing.sharedWith.map((share) => ({ ...share })) : [];

  const duplicate = buildDuplicatedList(existing, newListId, userId, taskIds, sharedWith, now);
  db.lists[duplicate.id] = duplicate;
  await saveDb(db);
  return { status: "ok", list: duplicate };
}

export type ShareListOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "deleted" }
  | { status: "user_not_found" }
  | { status: "self_share" }
  | { status: "ok"; list: TaskList };

export async function shareList(id: string, ownerId: string, input: ShareListInput): Promise<ShareListOutcome> {
  const db = await getDb();
  const existing = db.lists[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (!canViewList(existing, ownerId)) {
    return { status: "not_found" };
  }

  if (!canManageListSharing(existing, ownerId)) {
    return { status: "forbidden" };
  }

  if (existing.deletedAt !== null) {
    return { status: "deleted" };
  }

  const targetUser = input.userId ? await findUserById(input.userId) : await findUserByEmail(input.email!);
  if (!targetUser) {
    return { status: "user_not_found" };
  }

  if (targetUser.id === ownerId) {
    return { status: "self_share" };
  }

  const now = new Date().toISOString();
  const updated: TaskList = {
    ...existing,
    sharedWith: applyListShare(existing.sharedWith, targetUser.id, input.access),
    lastActivityAt: now,
  };
  db.lists[id] = updated;
  await saveDb(db);
  return { status: "ok", list: updated };
}

export type DeleteListOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; list: TaskList };

export async function deleteList(id: string, userId: string): Promise<DeleteListOutcome> {
  const db = await getDb();
  const existing = db.lists[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (!canViewList(existing, userId)) {
    return { status: "not_found" };
  }

  if (!canDeleteList(existing, userId)) {
    return { status: "forbidden" };
  }

  if (existing.deletedAt !== null) {
    return { status: "ok", list: existing };
  }

  const now = new Date().toISOString();
  const updated: TaskList = {
    ...existing,
    deletedAt: now,
    history: [...existing.history, buildListDeletionHistoryEntry(existing, userId, now)],
    lastActivityAt: now,
  };
  db.lists[id] = updated;
  await saveDb(db);
  return { status: "ok", list: updated };
}

export type RestoreListOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "expired" }
  | { status: "ok"; list: TaskList };

export async function restoreList(id: string, userId: string, now: Date): Promise<RestoreListOutcome> {
  const db = await getDb();
  const existing = db.lists[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (!canViewList(existing, userId)) {
    return { status: "not_found" };
  }

  if (!canDeleteList(existing, userId)) {
    return { status: "forbidden" };
  }

  if (existing.deletedAt === null) {
    return { status: "ok", list: existing };
  }

  if (!canRestoreList(existing, now)) {
    return { status: "expired" };
  }

  const nowIso = now.toISOString();
  const updated: TaskList = {
    ...existing,
    deletedAt: null,
    history: [...existing.history, buildListRestorationHistoryEntry(existing, userId, nowIso)],
    lastActivityAt: nowIso,
  };
  db.lists[id] = updated;
  await saveDb(db);
  return { status: "ok", list: updated };
}
