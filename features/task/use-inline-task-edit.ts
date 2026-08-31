"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/entities/task/schema";
import { updateTaskInputSchema, type UpdateTaskInput } from "@/entities/task/requests";
import { requestUpdateTask } from "@/features/task/update-task-request";

export const INLINE_TASK_AUTOSAVE_MS = 400;

const INLINE_TASK_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "category",
  "tags",
  "deadline",
  "estimatedMin",
] as const;

export type InlineTaskFieldKey = (typeof INLINE_TASK_FIELDS)[number];

export type InlineSaveStatus = "idle" | "saving" | "saved" | "error" | "invalid";

type InlineFieldValues = {
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  tags: string;
  deadline: string;
  estimatedMin: string;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (iso === null) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (value === "") return null;
  return new Date(value).toISOString();
}

function taskToInlineValues(task: Task): InlineFieldValues {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: String(task.priority),
    category: task.category ?? "",
    tags: task.tags.join(", "),
    deadline: toDatetimeLocalValue(task.deadline),
    estimatedMin: String(task.estimatedMin),
  };
}

function fieldErrorMessage(field: InlineTaskFieldKey): string {
  switch (field) {
    case "title":
      return "Укажите название задачи (не более 300 символов)";
    case "description":
      return "Слишком длинное описание";
    case "priority":
      return "Приоритет должен быть числом от 1 до 5";
    case "estimatedMin":
      return "Оценка времени не может быть отрицательной";
    case "deadline":
      return "Некорректная дата";
    default:
      return "Проверьте правильность заполнения полей";
  }
}

function parseInlineField(
  field: InlineTaskFieldKey,
  raw: string,
): { ok: true; patch: UpdateTaskInput } | { ok: false; message: string } {
  let patch: UpdateTaskInput;
  switch (field) {
    case "title":
      patch = { title: raw.trim() };
      break;
    case "description":
      patch = { description: raw };
      break;
    case "status":
      patch = { status: raw as TaskStatus };
      break;
    case "priority":
      patch = { priority: Number(raw) };
      break;
    case "category":
      patch = { category: raw.trim() === "" ? null : raw.trim() };
      break;
    case "tags":
      patch = {
        tags: raw
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      };
      break;
    case "deadline":
      if (raw !== "" && Number.isNaN(Date.parse(raw))) {
        return { ok: false, message: fieldErrorMessage("deadline") };
      }
      patch = { deadline: fromDatetimeLocalValue(raw) };
      break;
    case "estimatedMin":
      patch = { estimatedMin: Number(raw) };
      break;
  }

  const parsed = updateTaskInputSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, message: fieldErrorMessage(field) };
  }
  return { ok: true, patch: parsed.data };
}

function isSameAsCommitted(field: InlineTaskFieldKey, patch: UpdateTaskInput, task: Task): boolean {
  switch (field) {
    case "title":
      return patch.title === task.title;
    case "description":
      return patch.description === task.description;
    case "status":
      return patch.status === task.status;
    case "priority":
      return patch.priority === task.priority;
    case "category":
      return (patch.category ?? null) === task.category;
    case "tags":
      return JSON.stringify(patch.tags) === JSON.stringify(task.tags);
    case "deadline":
      return toDatetimeLocalValue(patch.deadline ?? null) === toDatetimeLocalValue(task.deadline);
    case "estimatedMin":
      return patch.estimatedMin === task.estimatedMin;
  }
}

function applyPatchToTask(task: Task, patch: UpdateTaskInput): Task {
  return { ...task, ...patch };
}

// Keeps `keep`'s value for one inline field on top of an otherwise-external
// task snapshot — used to preserve exactly the field(s) a user is actively
// editing/saving while merging in everything else from another user's change.
function preserveField(external: Task, keep: Task, field: InlineTaskFieldKey): Task {
  switch (field) {
    case "title":
      return { ...external, title: keep.title };
    case "description":
      return { ...external, description: keep.description };
    case "status":
      return { ...external, status: keep.status };
    case "priority":
      return { ...external, priority: keep.priority };
    case "category":
      return { ...external, category: keep.category };
    case "tags":
      return { ...external, tags: keep.tags };
    case "deadline":
      return { ...external, deadline: keep.deadline };
    case "estimatedMin":
      return { ...external, estimatedMin: keep.estimatedMin };
  }
}

function overlayDrafts(
  base: Task,
  values: InlineFieldValues,
  inflight: ReadonlySet<InlineTaskFieldKey>,
  skip?: InlineTaskFieldKey,
): Task {
  let next = base;
  for (const field of INLINE_TASK_FIELDS) {
    if (field === skip || !inflight.has(field)) {
      continue;
    }
    const parsed = parseInlineField(field, values[field]);
    if (parsed.ok) {
      next = applyPatchToTask(next, parsed.patch);
    }
  }
  return next;
}

const IDLE_STATUSES: Record<InlineTaskFieldKey, InlineSaveStatus> = {
  title: "idle",
  description: "idle",
  status: "idle",
  priority: "idle",
  category: "idle",
  tags: "idle",
  deadline: "idle",
  estimatedMin: "idle",
};

const EMPTY_MESSAGES: Record<InlineTaskFieldKey, string | null> = {
  title: null,
  description: null,
  status: null,
  priority: null,
  category: null,
  tags: null,
  deadline: null,
  estimatedMin: null,
};

const ZERO_SEQ: Record<InlineTaskFieldKey, number> = {
  title: 0,
  description: 0,
  status: 0,
  priority: 0,
  category: 0,
  tags: 0,
  deadline: 0,
  estimatedMin: 0,
};

export interface UseInlineTaskEditParams {
  task: Task;
  enabled: boolean;
  onTaskUpdated: (task: Task) => void;
}

export interface UseInlineTaskEditResult {
  values: InlineFieldValues;
  committed: Task;
  setField: (field: InlineTaskFieldKey, value: string) => void;
  revertField: (field: InlineTaskFieldKey) => void;
  flushField: (field: InlineTaskFieldKey) => void;
  statusOf: (field: InlineTaskFieldKey) => InlineSaveStatus;
  messageOf: (field: InlineTaskFieldKey) => string | null;
  /**
   * Merges another user's task snapshot in — every field the user isn't
   * currently editing or saving takes the external value; any field with an
   * unsaved draft or an in-flight autosave keeps its local value untouched.
   * Returns the resulting task for the caller to pass to onTaskUpdated.
   */
  applyExternalTask: (external: Task) => Task;
}

export function useInlineTaskEdit({
  task,
  enabled,
  onTaskUpdated,
}: UseInlineTaskEditParams): UseInlineTaskEditResult {
  const [values, setValues] = useState<InlineFieldValues>(() => taskToInlineValues(task));
  const [committed, setCommitted] = useState(task);
  const [statuses, setStatuses] = useState(IDLE_STATUSES);
  const [messages, setMessages] = useState(EMPTY_MESSAGES);

  const valuesRef = useRef(values);
  const committedRef = useRef(committed);
  const inflightRef = useRef(new Set<InlineTaskFieldKey>());
  const seqRef = useRef({ ...ZERO_SEQ });
  const onTaskUpdatedRef = useRef(onTaskUpdated);
  const enabledRef = useRef(enabled);

  const debounceTimers = useRef<Partial<Record<InlineTaskFieldKey, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    onTaskUpdatedRef.current = onTaskUpdated;
    enabledRef.current = enabled;
  });

  const saveField = useCallback(async (field: InlineTaskFieldKey, raw: string) => {
    if (!enabledRef.current) {
      return;
    }

    const parsed = parseInlineField(field, raw);
    if (!parsed.ok) {
      setStatuses((current) => ({ ...current, [field]: "invalid" }));
      setMessages((current) => ({ ...current, [field]: parsed.message }));
      return;
    }

    if (isSameAsCommitted(field, parsed.patch, committedRef.current)) {
      return;
    }

    const seq = ++seqRef.current[field];
    inflightRef.current.add(field);
    setStatuses((current) => ({ ...current, [field]: "saving" }));
    setMessages((current) => ({ ...current, [field]: null }));

    const optimistic = overlayDrafts(
      applyPatchToTask(committedRef.current, parsed.patch),
      valuesRef.current,
      inflightRef.current,
      field,
    );
    onTaskUpdatedRef.current(optimistic);

    const result = await requestUpdateTask(committedRef.current.id, parsed.patch);
    if (seqRef.current[field] !== seq) {
      return;
    }

    inflightRef.current.delete(field);

    if (result.status === "error") {
      const restored = taskToInlineValues(committedRef.current)[field];
      const restoredValues = { ...valuesRef.current, [field]: restored };
      valuesRef.current = restoredValues;
      setValues((current) => ({ ...current, [field]: restored }));
      setStatuses((current) => ({ ...current, [field]: "error" }));
      setMessages((current) => ({ ...current, [field]: result.message }));
      onTaskUpdatedRef.current(overlayDrafts(committedRef.current, restoredValues, inflightRef.current));
      return;
    }

    const merged = overlayDrafts(result.task, valuesRef.current, inflightRef.current);
    committedRef.current = merged;
    setCommitted(merged);
    setStatuses((current) => ({ ...current, [field]: "saved" }));
    setMessages((current) => ({ ...current, [field]: null }));
    onTaskUpdatedRef.current(merged);
  }, []);

  const scheduleSave = useCallback(
    (field: InlineTaskFieldKey, raw: string) => {
      const existing = debounceTimers.current[field];
      if (existing) {
        clearTimeout(existing);
      }
      debounceTimers.current[field] = setTimeout(() => {
        void saveField(field, raw);
      }, INLINE_TASK_AUTOSAVE_MS);
    },
    [saveField],
  );

  const setField = useCallback(
    (field: InlineTaskFieldKey, value: string) => {
      setValues((current) => {
        const next = { ...current, [field]: value };
        valuesRef.current = next;
        return next;
      });
      setStatuses((current) => ({ ...current, [field]: "idle" }));
      setMessages((current) => ({ ...current, [field]: null }));
      scheduleSave(field, value);
    },
    [scheduleSave],
  );

  const revertField = useCallback(
    (field: InlineTaskFieldKey) => {
      const restored = taskToInlineValues(committedRef.current)[field];
      const existing = debounceTimers.current[field];
      if (existing) {
        clearTimeout(existing);
      }
      setValues((current) => {
        const next = { ...current, [field]: restored };
        valuesRef.current = next;
        return next;
      });
      setStatuses((current) => ({ ...current, [field]: "idle" }));
      setMessages((current) => ({ ...current, [field]: null }));
    },
    [],
  );

  const flushField = useCallback(
    (field: InlineTaskFieldKey) => {
      const existing = debounceTimers.current[field];
      if (existing) {
        clearTimeout(existing);
      }
      void saveField(field, valuesRef.current[field]);
    },
    [saveField],
  );

  const statusOf = useCallback((field: InlineTaskFieldKey) => statuses[field], [statuses]);
  const messageOf = useCallback((field: InlineTaskFieldKey) => messages[field], [messages]);

  const applyExternalTask = useCallback((external: Task): Task => {
    const untouched: InlineTaskFieldKey[] = [];
    const held: InlineTaskFieldKey[] = [];
    for (const field of INLINE_TASK_FIELDS) {
      const isDirty = valuesRef.current[field] !== taskToInlineValues(committedRef.current)[field];
      if (inflightRef.current.has(field) || isDirty) {
        held.push(field);
      } else {
        untouched.push(field);
      }
    }

    let mergedCommitted = external;
    for (const field of held) {
      mergedCommitted = preserveField(mergedCommitted, committedRef.current, field);
    }
    committedRef.current = mergedCommitted;
    setCommitted(mergedCommitted);

    const nextValues = { ...valuesRef.current };
    for (const field of untouched) {
      nextValues[field] = taskToInlineValues(mergedCommitted)[field];
    }
    valuesRef.current = nextValues;
    setValues(nextValues);

    return overlayDrafts(mergedCommitted, nextValues, inflightRef.current);
  }, []);

  return {
    values,
    committed,
    setField,
    revertField,
    flushField,
    statusOf,
    messageOf,
    applyExternalTask,
  };
}
