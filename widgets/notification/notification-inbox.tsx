"use client";

import { useNotifications } from "@/features/notification/use-notifications";
import { Button } from "@/shared/ui/button";

export function NotificationInbox() {
  const { notifications, error, dismiss } = useNotifications();

  if (notifications.length === 0 && error === null) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 flex w-[min(100%-2rem,22rem)] flex-col gap-2"
      data-testid="notification-inbox"
    >
      {error ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notifications.map((item) => (
        <article
          key={item.key}
          className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm"
          data-testid="notification-item"
        >
          <h2 className="text-sm font-semibold">{item.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              void dismiss(item.key);
            }}
          >
            Скрыть
          </Button>
        </article>
      ))}
    </div>
  );
}
