import { baseApi } from "@/shared/api/base-api";
import type { TaskChangeStatus } from "@/features/task/get-task-change-status";

export const taskChangesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTaskChanges: builder.query<TaskChangeStatus, { taskId: string; since: string }>({
      query: ({ taskId, since }) => `/tasks/${taskId}/changes?since=${encodeURIComponent(since)}`,
      transformResponse: (response: { data: TaskChangeStatus }) => response.data,
    }),
  }),
  overrideExisting: false,
});

export const { useGetTaskChangesQuery } = taskChangesApi;
