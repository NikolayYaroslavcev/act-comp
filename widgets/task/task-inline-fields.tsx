import type { KeyboardEvent } from "react";
import type { InlineSaveStatus, InlineTaskFieldKey } from "@/features/task/use-inline-task-edit";
import { cn } from "@/shared/lib/utils";

export function InlineSaveStatus({
  field,
  status,
  message,
}: {
  field: InlineTaskFieldKey;
  status: InlineSaveStatus;
  message: string | null;
}) {
  const text =
    status === "saving"
      ? "Сохранение..."
      : status === "saved"
        ? "Сохранено"
        : status === "error" || status === "invalid"
          ? (message ?? "")
          : "";

  return (
    <p
      aria-live="polite"
      id={`task-inline-${field}-status`}
      data-testid={`task-inline-${field}-status`}
      className={cn(
        "min-h-4 text-xs break-words",
        status === "error" || status === "invalid" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {text}
    </p>
  );
}

export function inlineFieldKeyDown(
  field: InlineTaskFieldKey,
  isMultiline: boolean,
  onRevert: (field: InlineTaskFieldKey) => void,
  onFlush: (field: InlineTaskFieldKey) => void,
) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onRevert(field);
      return;
    }
    if (!isMultiline && event.key === "Enter") {
      event.preventDefault();
      onFlush(field);
    }
  };
}
