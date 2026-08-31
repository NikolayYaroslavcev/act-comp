/** Canonical UI dates. Local timezone; export pipelines keep their own UTC labels. */
const dateFormatter = new Intl.DateTimeFormat("ru", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeStyle: "short" });

/** Canonical date-only display format used throughout the UI (deadlines, due dates). */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Canonical date+time display format used throughout the UI (activity, comments, uploads, history). */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
