import { baseApi } from "@/shared/api/base-api";
import type { CommentWithAuthor } from "@/entities/comment/dto";

export const commentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTaskComments: builder.query<CommentWithAuthor[], string>({
      query: (taskId) => `/tasks/${taskId}/comments`,
      transformResponse: (response: { data: CommentWithAuthor[] }) => response.data,
      providesTags: (_result, _error, taskId) => [{ type: "Comment", id: taskId }],
    }),
    // Appends the created comment straight into the getTaskComments cache
    // entry on success rather than invalidating it — this mirrors the
    // pre-migration hook exactly (one POST, no follow-up GET) and keeps the
    // existing UI/API contract (and its call-count assertions) unchanged.
    createTaskComment: builder.mutation<CommentWithAuthor, { taskId: string; text: string }>({
      query: ({ taskId, text }) => ({ url: `/tasks/${taskId}/comments`, method: "POST", body: { text } }),
      transformResponse: (response: { data: CommentWithAuthor }) => response.data,
      async onQueryStarted({ taskId }, { dispatch, queryFulfilled }) {
        try {
          const { data: created } = await queryFulfilled;
          dispatch(
            commentsApi.util.updateQueryData("getTaskComments", taskId, (draft) => {
              draft.push(created);
            }),
          );
        } catch {
          // Failure is surfaced to the caller via the mutation promise
          // itself (see use-task-comments.ts's addComment) — nothing to
          // append to the cache when the request didn't succeed.
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const { useGetTaskCommentsQuery, useCreateTaskCommentMutation } = commentsApi;
