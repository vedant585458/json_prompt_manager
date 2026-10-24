import { Fragment } from 'react';

import { highlightSegments } from '@/domain/search';

export interface HighlightedTextProps {
  readonly text: string;
  /** Raw query; an empty query renders the text unchanged. */
  readonly query: string;
  readonly className?: string;
}

/**
 * Renders text with the matched query terms marked.
 *
 * Segments come from the domain search module, so what is highlighted is exactly
 * what matched, and no user text is ever interpreted as markup.
 */
export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const segments = highlightSegments(text, query);

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark
            // Segments are positional and stable for a given text and query.
            key={index}
            className="rounded-xs bg-accent-soft px-0.5 text-accent"
          >
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </span>
  );
}
