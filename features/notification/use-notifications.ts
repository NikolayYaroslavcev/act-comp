"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DueNotification } from "@/entities/notification/model";
import {
  useAcknowledgeNotificationsMutation,
  useGetNotificationsQuery,
} from "@/features/notification/notifications-api";

const POLL_MS = 15_000;
const UNEXPECTED_ERROR_MESSAGE = "Не удалось загрузить уведомления";

// Same-browser-tabs only — BroadcastChannel never reaches another device or
// another browser. Cross-device/server consistency still comes exclusively
// from the existing POLL_MS interval below; this channel only lets sibling
// tabs of *this* browser skip the wait when the "otherUserChanges" setting
// is on. It carries no notification content (transport only) — the due-list
// itself always comes from the real GET /api/notifications request.
const CROSS_TAB_CHANNEL_NAME = "task-manager:notifications";

export interface UseNotificationsOptions {
  crossTabSyncEnabled?: boolean;
}

export interface UseNotificationsResult {
  notifications: DueNotification[];
  error: string | null;
  dismiss: (key: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Threshold/dedup/ack semantics live entirely server-side
 * (entities/notification/model.ts); this hook just relays the
 * query/mutation lifecycle.
 */
export function useNotifications({ crossTabSyncEnabled = false }: UseNotificationsOptions = {}): UseNotificationsResult {
  const { data, error: queryError, refetch } = useGetNotificationsQuery(undefined, {
    pollingInterval: POLL_MS,
  });
  const [acknowledge] = useAcknowledgeNotificationsMutation();
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!crossTabSyncEnabled || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(CROSS_TAB_CHANNEL_NAME);
    channel.onmessage = () => {
      void refetch();
    };
    channelRef.current = channel;

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [crossTabSyncEnabled, refetch]);

  const notifications = data ?? [];

  // A missing session (401) reads as "nothing to show", not an error banner —
  // matches the pre-migration fetch-based behavior exactly.
  const isUnauthorized = Boolean(queryError && "status" in queryError && queryError.status === 401);
  const error = queryError && !isUnauthorized ? UNEXPECTED_ERROR_MESSAGE : null;

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const dismiss = useCallback(
    async (key: string) => {
      try {
        await acknowledge([key]).unwrap();
        channelRef.current?.postMessage({ type: "acked" });
      } catch {
        // acknowledgeNotifications' onQueryStarted already rolls the
        // optimistic removal back on failure — nothing further to do here.
      }
    },
    [acknowledge],
  );

  return { notifications, error, dismiss, refresh };
}
