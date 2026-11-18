export interface SpanOptions {
  /** Rule: text wrapped in one of `markers` (e.g. `_word_` or `/word/`). */
  marked: boolean;
  /** The wrapping characters for the `marked` rule; each must satisfy `isValidMarker` (invalid ones are skipped). */
  markers: string[];
  bold: boolean;
  capitalized: boolean;
  /** When true, capitalized words at the start of a sentence are spellchecked as normal. */
  spellcheckSentenceStart: boolean;
}

/** Half-open range [from, to), offsets relative to the start of the line. */
export interface Span {
  from: number;
  to: number;
}

/** Lines longer than this are skipped, which also bounds worst-case regex time. */
export const MAX_LINE_LENGTH = 10_000;

/** A marker is exactly one punctuation or symbol character (so never a letter, digit or space). */
export function isValidMarker(marker: string): boolean {
  return /^[\p{P}\p{S}]$/u.test(marker);
}

/** Most marker characters that can be active at once. */
export const MAX_MARKERS = 8;

/**
 * Parses text typed into the settings field: every non-space character is a marker. Returns the
 * unique markers, or null when the input is empty, has an invalid character, or has too many.
 */
export function parseMarkers(input: string): string[] | null {
  const unique = [...new Set([...input.replace(/\s+/g, "")])];
  if (unique.length === 0 || unique.length > MAX_MARKERS || !unique.every(isValidMarker)) return null;
  return unique;
}

const markedRegexCache = new Map<string, RegExp>();

/**
 * Regex for `<m>word<m>` / `<m>a phrase<m>`: the marker is not glued to letters/digits/itself
 * (so snake_case, and/or, URLs and `__init__` are ignored), has a non-space just inside both ends,
 * and does not appear inside. Group 1 is the inner text. The marker is embedded as a \u{...}
 * escape so any character, including regex-special ones, is matched literally.
 */
function markedRegex(marker: string): RegExp {
  let re = markedRegexCache.get(marker);
  if (!re) {
    const m = `\\u{${(marker.codePointAt(0) as number).toString(16)}}`;
    re = new RegExp(
      `(?<![\\p{L}\\p{N}${m}])${m}(?=[^\\s${m}])([^${m}]*?[^\\s${m}])${m}(?![\\p{L}\\p{N}${m}])`,
      "gu",
    );
    markedRegexCache.set(marker, re);
  }
  return re;
}

// `**bold**`
const STAR_BOLD_RE = /\*\*(?=\S)(.+?)(?<=\S)\*\*/gu;
// `__bold__`
const UNDERSCORE_BOLD_RE = /(?<![\p{L}\p{N}_])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}_])/gu;

// A capitalized word: uppercase letter, then letters/marks/digits/apostrophes. Not glued to a
// preceding letter/digit/underscore. Trailing apostrophes (closing quotes) are trimmed afterwards.
const CAPITALIZED_RE = /(?<![\p{L}\p{M}\p{N}_])\p{Lu}[\p{L}\p{M}\p{N}'\u2019]*/gu;
// Leading markdown block markers (list, task checkbox, quote, heading) and opening quotes/brackets.
const BLOCK_PREFIX_RE = /^\s*(?:(?:[-*+]|\d+[.)])\s+|\[[ xX]\]\s+|>\s*|#{1,6}\s+)*["'\u201C\u2018(\[]*/u;
// Text that ends a sentence: terminator, optional closing quotes/brackets, whitespace.
const SENTENCE_END_RE = /[.!?\u2026]["'\u201D\u2019)\]]*\s+$/u;

/** One `<marker>text<marker>` occurrence; offsets are relative to the start of the line. */
export interface MarkedMatch {
  marker: string;
  open: Span;
  inner: Span;
  close: Span;
}

/** Finds every marked occurrence on a line, for all given markers, sorted by position. */
export function findMarked(line: string, markers: readonly string[]): MarkedMatch[] {
  if (line.length > MAX_LINE_LENGTH) return [];

  const found: MarkedMatch[] = [];
  for (const marker of new Set(markers)) {
    if (!isValidMarker(marker)) continue;
    for (const m of line.matchAll(markedRegex(marker))) {
      const index = m.index as number;
      const innerFrom = index + marker.length;
      const innerTo = innerFrom + m[1].length;
      found.push({
        marker,
        open: { from: index, to: innerFrom },
        inner: { from: innerFrom, to: innerTo },
        close: { from: innerTo, to: innerTo + marker.length },
      });
    }
  }
  return found.sort((a, b) => a.open.from - b.open.from);
}

/** Returns the line with the opening and closing marker characters removed (for Reading view). */
export function stripMarkers(line: string, markers: readonly string[]): string {
  const removals = findMarked(line, markers)
    .flatMap((f) => [f.open, f.close])
    .sort((a, b) => a.from - b.from);
  if (removals.length === 0) return line;

  let out = "";
  let pos = 0;
  for (const r of removals) {
    out += line.slice(pos, r.from);
    pos = Math.max(pos, r.to);
  }
  return out + line.slice(pos);
}

/** Marks the inner text (group 1) of every match; `markerLength` is the opening marker's width. */
function collectInner(re: RegExp, markerLength: number, line: string, out: Span[]): void {
  for (const m of line.matchAll(re)) {
    const from = (m.index as number) + markerLength;
    out.push({ from, to: from + m[1].length });
  }
}

/** True when the text before a word means the word starts a sentence (or a markdown block). */
function startsSentence(before: string): boolean {
  const rest = before.replace(BLOCK_PREFIX_RE, "");
  return rest.length === 0 || SENTENCE_END_RE.test(rest);
}

function collectCapitalized(line: string, skipSentenceStart: boolean, out: Span[]): void {
  for (const m of line.matchAll(CAPITALIZED_RE)) {
    const from = m.index as number;
    if (skipSentenceStart && startsSentence(line.slice(0, from))) continue;
    out.push({ from, to: from + m[0].replace(/['\u2019]+$/, "").length });
  }
}

/** Sorts spans and merges any that overlap or touch, so the result is sorted and disjoint. */
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: Span[] = [];
  for (const s of sorted) {
    if (s.to <= s.from) continue;
    const last = merged[merged.length - 1];
    if (last && s.from <= last.to) {
      last.to = Math.max(last.to, s.to);
    } else {
      merged.push({ from: s.from, to: s.to });
    }
  }
  return merged;
}

/**
 * Finds the ranges of one line of text whose spellcheck squiggles should be suppressed.
 * Returned spans are non-empty, sorted and disjoint.
 */
export function findSpans(line: string, opts: SpanOptions): Span[] {
  if (line.length > MAX_LINE_LENGTH) return [];

  const spans: Span[] = [];
  if (opts.marked) {
    for (const match of findMarked(line, opts.markers)) spans.push(match.inner);
  }
  if (opts.bold) {
    collectInner(STAR_BOLD_RE, 2, line, spans);
    collectInner(UNDERSCORE_BOLD_RE, 2, line, spans);
  }
  if (opts.capitalized) collectCapitalized(line, opts.spellcheckSentenceStart, spans);
  return mergeSpans(spans);
}
