export interface HighlightSegment {
  text: string;
  matched: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits text into matched/unmatched segments for safe highlighting
 * (render matched segments in a <mark>, everything else as plain text —
 * no HTML string injection). Case-insensitive; preserves the original
 * text's casing in the returned segments.
 */
export function getHighlightSegments(text: string, query: string): HighlightSegment[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery === "") {
    return [{ text, matched: false }];
  }

  const pattern = new RegExp(escapeRegExp(trimmedQuery), "gi");
  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), matched: false });
    }
    segments.push({ text: match[0], matched: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), matched: false });
  }

  return segments.length > 0 ? segments : [{ text, matched: false }];
}
