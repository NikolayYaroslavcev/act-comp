import { Fragment } from "react";
import { getHighlightSegments } from "@/shared/lib/highlight";

interface HighlightedTextProps {
  text: string;
  query?: string;
}

export function HighlightedText({ text, query = "" }: HighlightedTextProps) {
  if (query.trim() === "") {
    return <>{text}</>;
  }

  return (
    <>
      {getHighlightSegments(text, query).map((segment, index) =>
        segment.matched ? (
          <mark key={index} className="rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-900/60">
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
