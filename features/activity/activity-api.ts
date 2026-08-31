import { baseApi } from "@/shared/api/base-api";
import type { TaskActivityItem } from "@/entities/activity/dto";

export const activityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTaskActivity: builder.query<TaskActivityItem[], string>({
      query: (taskId) => `/tasks/${taskId}/activity`,
      transformResponse: (response: { data: TaskActivityItem[] }) => response.data,
      providesTags: (_result, _error, taskId) => [{ type: "Activity", id: taskId }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetTaskActivityQuery } = activityApi;
