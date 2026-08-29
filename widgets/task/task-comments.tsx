"use client";

import { useState } from "react";
import { useTaskComments } from "@/features/comment/use-task-comments";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

interface TaskCommentsProps {
  taskId: string;
  canComment?: boolean;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeStyle: "short" });

export function TaskComments({ taskId, canComment = false }: TaskCommentsProps) {
  const { comments, isLoading, loadError, addComment, isSubmitting, submitError } = useTaskComments(taskId);
  const [text, setText] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || text.trim() === "") {
      return;
    }

    const ok = await addComment(text.trim());
    if (ok) {
      setText("");
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4" data-testid="task-comments">
      <h3 className="text-sm font-medium">Комментарии</h3>

      {isLoading && (
        <p className="text-sm text-muted-foreground" data-testid="task-comments-loading">
          Загрузка комментариев...
        </p>
      )}

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {loadError}
        </p>
      )}

      {!isLoading && !loadError && comments.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="task-comments-empty">
          Пока нет комментариев
        </p>
      )}

      {!isLoading && !loadError && comments.length > 0 && (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto" data-testid="task-comments-list">
          {comments.map((comment) => (
            <li
              key={comment.id}
              data-testid="task-comment"
              className="min-w-0 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                <span data-testid="task-comment-author" className="min-w-0 truncate">
                  {comment.authorEmail}
                </span>
                <span data-testid="task-comment-time" className="shrink-0">
                  {dateTimeFormatter.format(new Date(comment.createdAt))}
                </span>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap" data-testid="task-comment-text">
                {comment.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-2" data-testid="task-comment-form">
          {submitError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {submitError}
            </p>
          )}
          <Label htmlFor="task-comment-text">Ваш комментарий...</Label>
          <Textarea
            id="task-comment-text"
            data-testid="task-comment-input"
            disabled={isSubmitting}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              data-testid="task-comment-submit"
              disabled={isSubmitting || text.trim() === ""}
            >
              {isSubmitting ? "Отправка..." : "Добавить комментарий"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
