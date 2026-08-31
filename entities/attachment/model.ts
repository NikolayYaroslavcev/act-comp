export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

export const MAX_ATTACHMENT_FILENAME_LENGTH = 255;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Display-name only. Blob paths never use this string. */
export function sanitizeAttachmentFilename(filename: string): string {
  const cleaned = filename.replace(CONTROL_CHARS, "").trim();
  const truncated =
    cleaned.length > MAX_ATTACHMENT_FILENAME_LENGTH
      ? cleaned.slice(0, MAX_ATTACHMENT_FILENAME_LENGTH)
      : cleaned;
  return truncated.length > 0 ? truncated : "file";
}
