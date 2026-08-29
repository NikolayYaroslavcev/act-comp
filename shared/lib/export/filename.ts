const UNSAFE_FILENAME = /[\\/:*?"<>|]+/g;

export function exportFilename(listTitle: string, extension: "csv" | "pdf"): string {
  const cleaned = listTitle
    .replace(UNSAFE_FILENAME, "_")
    .replace(/\s+/g, " ")
    .replace(/^[_ ]+|[_ ]+$/g, "");
  const base = cleaned.length > 0 ? cleaned : "list";
  return `${base}-tasks.${extension}`;
}
