import { baseApi } from "@/shared/api/base-api";
import type { DueNotification } from "@/entities/notification/model";

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<DueNotification[], void>({
      query: () => "/notifications",
      transformResponse: (response: { data: DueNotification[] }) => response.data,
      providesTags: (result) =>
        result
          ? [...result.map((item) => ({ type: "Notification" as const, id: item.key })), { type: "Notification" as const, id: "LIST" }]
          : [{ type: "Notification" as const, id: "LIST" }],
    }),
    acknowledgeNotifications: builder.mutation<string[], string[]>({
      query: (keys) => ({ url: "/notifications", method: "PATCH", body: { keys } }),
      // Optimistically drop the acked keys from the cached list; if the
      // request fails, undo() restores the exact prior cache value so a
      // failed ack never silently loses a notification from view.
      async onQueryStarted(keys, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          notificationsApi.util.updateQueryData("getNotifications", undefined, (draft) => {
            return draft.filter((item) => !keys.includes(item.key));
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const { useGetNotificationsQuery, useAcknowledgeNotificationsMutation } = notificationsApi;
