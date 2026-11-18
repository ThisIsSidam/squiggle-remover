import { SquiggleSettings } from "./config";
import { findMarked, findSpans } from "./spans";

/**
 * What the editor should do to a range:
 * - spellcheck: turn spellcheck off
 * - marked: show the text of a marked word plain (no italics from `_` / `*` markers)
 * - hide: hide a marker character
 */
export type RangeKind = "spellcheck" | "marked" | "hide";

export interface PlannedRange {
  kind: RangeKind;
  from: number;
  to: number;
}

/**
 * Plans the decorations for one line. `base` is the document offset of the line start. Markers are
 * hidden only when `hide` is true and `isTouched(from, to)` says the cursor/selection is not on the
 * whole marked occurrence (markers included).
 */
export function planLine(
  text: string,
  base: number,
  settings: SquiggleSettings,
  hide: boolean,
  isTouched: (from: number, to: number) => boolean,
): PlannedRange[] {
  const planned: PlannedRange[] = [];

  for (const span of findSpans(text, settings)) {
    planned.push({ kind: "spellcheck", from: base + span.from, to: base + span.to });
  }

  if (settings.marked) {
    for (const match of findMarked(text, settings.markers)) {
      planned.push({ kind: "marked", from: base + match.inner.from, to: base + match.inner.to });
      if (hide && !isTouched(base + match.open.from, base + match.close.to)) {
        planned.push({ kind: "hide", from: base + match.open.from, to: base + match.open.to });
        planned.push({ kind: "hide", from: base + match.close.from, to: base + match.close.to });
      }
    }
  }
  return planned;
}
