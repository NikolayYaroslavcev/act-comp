"use client";

import { useCallback, useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import type { DueNotification } from "@/entities/notification/model";
import { useNotifications } from "@/features/notification/use-notifications";
import { Button } from "@/shared/ui/button";

const AUTO_DISMISS_MS = 8_000;

interface NotificationInboxProps {
  crossTabSyncEnabled?: boolean;
}

export function NotificationInbox({ crossTabSyncEnabled = false }: NotificationInboxProps = {}) {
  const { notifications, error, dismiss } = useNotifications({ crossTabSyncEnabled });
  const [snoozedKeys, setSnoozedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const snooze = useCallback((key: string) => {
    setSnoozedKeys((current) => new Set(current).add(key));
  }, []);
  const visible = notifications.filter((item) => !snoozedKeys.has(item.key));

  if (visible.length === 0 && error === null) {
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
      {visible.map((item) => (
        <NotificationToast
          key={item.key}
          item={item}
          onDismiss={dismiss}
          onSnooze={snooze}
        />
      ))}
    </div>
  );
}

function NotificationToast({
  item,
  onDismiss,
  onSnooze,
}: {
  item: DueNotification;
  onDismiss: (key: string) => void;
  onSnooze: (key: string) => void;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSnooze(item.key);
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [item.key, onSnooze, paused]);

  return (
    <article
      className="motion-reduce:animate-none animate-in fade-in slide-in-from-right-4 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm duration-300 ease-out"
      data-testid="notification-item"
      onPointerEnter={() => {
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">{item.title}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 opacity-70 hover:opacity-100"
          aria-label="Скрыть"
          onClick={() => {
            void onDismiss(item.key);
          }}
        >
          <XIcon />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
    </article>
  );
}
