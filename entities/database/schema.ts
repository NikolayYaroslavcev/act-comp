import { z } from "zod";
import { userSchema } from "@/entities/user/schema";
import { sessionSchema } from "@/entities/session/schema";
import { listSchema } from "@/entities/list/schema";
import { taskSchema } from "@/entities/task/schema";
import { commentSchema } from "@/entities/comment/schema";
import { activitySchema } from "@/entities/activity/schema";
import { savedFilterSchema } from "@/entities/saved-filter/schema";
import { attachmentSchema } from "@/entities/attachment/schema";

export const databaseSchema = z.object({
  users: z.record(z.string(), userSchema),
  sessions: z.record(z.string(), sessionSchema),
  lists: z.record(z.string(), listSchema),
  tasks: z.record(z.string(), taskSchema),
  comments: z.record(z.string(), commentSchema),
  activityLog: z.record(z.string(), activitySchema),
  savedFilters: z.record(z.string(), savedFilterSchema),
  notificationAcks: z.record(z.string(), z.array(z.string())).default({}),
  attachments: z.record(z.string(), attachmentSchema).default({}),
});

export type Database = z.infer<typeof databaseSchema>;
