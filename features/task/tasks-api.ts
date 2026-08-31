import { baseApi } from "@/shared/api/base-api";
import type { Task } from "@/entities/task/schema";
import type { UpdateTaskInput } from "@/entities/task/requests";
import type { CascadeUpdate } from "@/entities/task/model";

export interface UpdateTaskResult {
  task: Task;
  cascade: CascadeUpdate[];
}

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    updateTask: builder.mutation<UpdateTaskResult, { id: string; patch: UpdateTaskInput }>({
      query: ({ id, patch }) => ({ url: `/tasks/${id}`, method: "PATCH", body: patch }),
      transformResponse: (response: { data: UpdateTaskResult }) => response.data,
    }),
  }),
  overrideExisting: false,
});

export const { useUpdateTaskMutation } = tasksApi;
