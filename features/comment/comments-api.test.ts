import { afterEach, describe, expect, it, vi } from "vitest";
import { commentsApi } from "@/features/comment/comments-api";
import { makeStore } from "@/shared/store/store";
import type { CommentWithAuthor } from "@/entities/comment/dto";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeComment(overrides: Partial<CommentWithAuthor>): CommentWithAuthor {
  return {
    id: "c1",
    taskId: "t1",
    authorId: "u1",
    authorEmail: "admin@example.com",
    text: "Hello",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("commentsApi", () => {
  it("getTaskComments unwraps the { data } envelope, tagged by taskId", async () => {
    const comment = makeComment({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: [comment] })));
    const store = makeStore();

    const result = await store.dispatch(commentsApi.endpoints.getTaskComments.initiate("t1"));

    expect(result.data).toEqual([comment]);
  });

  it("createTaskComment appends the created comment into the cached list for that task", async () => {
    const existing = makeComment({});
    const created = makeComment({ id: "c2", text: "New comment" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: [existing] }))
      .mockResolvedValueOnce(jsonResponse(201, { data: created }));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();

    const subscription = store.dispatch(commentsApi.endpoints.getTaskComments.initiate("t1"));
    await subscription;

    const mutationResult = await store.dispatch(
      commentsApi.endpoints.createTaskComment.initiate({ taskId: "t1", text: "New comment" }),
    );
    expect(mutationResult.data).toEqual(created);

    const cached = commentsApi.endpoints.getTaskComments.select("t1")(store.getState());
    expect(cached.data).toEqual([existing, created]);
    subscription.unsubscribe();
  });

  it("does not touch the cache for a different task", async () => {
    const existing = makeComment({});
    const created = makeComment({ id: "c2", taskId: "t2" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: [existing] }))
      .mockResolvedValueOnce(jsonResponse(201, { data: created }));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();

    const subscription = store.dispatch(commentsApi.endpoints.getTaskComments.initiate("t1"));
    await subscription;

    await store.dispatch(commentsApi.endpoints.createTaskComment.initiate({ taskId: "t2", text: "Hi" }));

    const cached = commentsApi.endpoints.getTaskComments.select("t1")(store.getState());
    expect(cached.data).toEqual([existing]);
    subscription.unsubscribe();
  });
});
