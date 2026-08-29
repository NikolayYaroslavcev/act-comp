import { z } from "zod";

export const idSchema = z.string().min(1);

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const historyEntrySchema = z.object({
  field: z.string().min(1),
  old: z.unknown(),
  new: z.unknown(),
  at: isoDateTimeSchema,
  byUserId: idSchema,
});

export type HistoryEntry = z.infer<typeof historyEntrySchema>;
