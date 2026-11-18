import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, SquiggleSettings } from "../src/config";
import { planLine, PlannedRange } from "../src/ranges";

const settings = (o: Partial<SquiggleSettings>): SquiggleSettings => ({
  ...DEFAULT_SETTINGS,
  markers: ["/"],
  bold: false,
  capitalized: false,
  ...o,
});
const key = (r: PlannedRange) => `${r.kind}:${r.from}-${r.to}`;
const plan = (line: string, base: number, o: Partial<SquiggleSettings>, hide: boolean, touched = false) =>
  planLine(line, base, settings(o), hide, () => touched).map(key).sort();

describe("planLine", () => {
  it("turns spellcheck off, styles the word plain and hides both markers", () => {
    expect(plan("a /bc/ d", 100, {}, true)).toEqual(
      ["hide:102-103", "hide:105-106", "marked:103-105", "spellcheck:103-105"].sort(),
    );
  });
  it("keeps markers visible when the match is touched by the cursor", () => {
    expect(plan("a /bc/ d", 100, {}, true, true)).toEqual(["marked:103-105", "spellcheck:103-105"]);
  });
  it("passes the full match extent (markers included) to the touch check", () => {
    const seen: Array<[number, number]> = [];
    planLine("a /bc/ d", 100, settings({}), true, (from, to) => (seen.push([from, to]), false));
    expect(seen).toEqual([[102, 106]]);
  });
  it("does not hide when hiding is not allowed (Source mode or setting off)", () => {
    expect(plan("a /bc/ d", 100, {}, false)).toEqual(["marked:103-105", "spellcheck:103-105"]);
  });
  it("does nothing for the marked rule when it is off, but other rules still apply", () => {
    expect(plan("/bc/ **d**", 0, { marked: false, bold: true }, true)).toEqual(["spellcheck:7-8"]);
  });
  it("hides markers of several marker characters", () => {
    expect(plan("/a/ ~b~", 0, { markers: ["/", "~"] }, true)).toEqual(
      ["hide:0-1", "hide:2-3", "hide:4-5", "hide:6-7", "marked:1-2", "marked:5-6", "spellcheck:1-2", "spellcheck:5-6"].sort(),
    );
  });
});
