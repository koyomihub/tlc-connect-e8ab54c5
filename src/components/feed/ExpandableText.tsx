import { useState, useMemo } from 'react';

interface ExpandableTextProps {
  text: string;
  className?: string;
  /** Character threshold beyond which we collapse */
  charLimit?: number;
  /** Line/sentence count threshold beyond which we collapse */
  lineLimit?: number;
}

/**
 * Shows the first few sentences/lines of long text with a "Show more" toggle.
 * Short content renders as-is.
 */
export function ExpandableText({
  text,
  className,
  charLimit = 280,
  lineLimit = 4,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);

  const { preview, isLong } = useMemo(() => {
    const trimmed = text ?? '';
    const lines = trimmed.split('\n');
    // Sentence-ish split: keep terminator, fall back to original on no matches
    const sentences = trimmed.match(/[^.!?\n]+[.!?]+(\s+|$)|[^.!?\n]+$/g) ?? [trimmed];

    const tooManyLines = lines.length > lineLimit;
    const tooManySentences = sentences.length > lineLimit;
    const tooLong = trimmed.length > charLimit;

    if (!tooLong && !tooManyLines && !tooManySentences) {
      return { preview: trimmed, isLong: false };
    }

    // Prefer cutting by sentences/lines, then enforce charLimit
    let candidate = sentences.slice(0, lineLimit).join('').trim();
    if (tooManyLines) {
      candidate = lines.slice(0, lineLimit).join('\n');
    }
    if (candidate.length > charLimit) {
      candidate = candidate.slice(0, charLimit).trimEnd() + '…';
    }
    return { preview: candidate, isLong: true };
  }, [text, charLimit, lineLimit]);

  if (!isLong) {
    return <p className={className}>{text}</p>;
  }

  return (
    <div>
      <p className={className}>
        {expanded ? text : preview}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="mt-1 text-sm font-medium text-primary hover:underline focus:outline-none"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}
