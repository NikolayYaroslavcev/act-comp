import type { Attachment } from "@/entities/attachment/schema";

export interface AttachmentWithUploader extends Attachment {
  uploaderEmail: string;
}
