import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/config";

describe("sanitizeSettings", () => {
  it("returns defaults for missing data, without sharing the folders array", () => {
    const s = sanitizeSettings(null);
    expect(s).toEqual(DEFAULT_SETTINGS);
    s.folders.push("x");
    expect(DEFAULT_SETTINGS.folders).toEqual([]);
  });
  it("keeps valid saved values", () => {
    const saved = { folders: ["A", "B/C"], markers: ["/", "~"], marked: false, hideMarkers: false, bold: false, capitalized: false, spellcheckSentenceStart: true };
    expect(sanitizeSettings(saved)).toEqual(saved);
  });
  it("migrates the old `underscore` toggle to `marked` and drops the old key", () => {
    const s = sanitizeSettings({ underscore: false });
    expect(s.marked).toBe(false);
    expect("underscore" in s).toBe(false);
  });
  it("falls back to defaults for invalid values", () => {
    const s = sanitizeSettings({ markers: ["ab"], hideMarkers: "no", folders: "Hinglish", bold: "yes", marked: 1 });
    expect(s.markers).toEqual(["_"]);
    expect(s.hideMarkers).toBe(true);
    expect(s.folders).toEqual([]);
    expect(s.bold).toBe(true);
    expect(s.marked).toBe(true);
  });
  it("drops non-string folder entries", () => {
    expect(sanitizeSettings({ folders: ["A", 3, null, "B"] }).folders).toEqual(["A", "B"]);
  });
  it("migrates the single `marker` setting to `markers`", () => {
    const s = sanitizeSettings({ marker: "/" });
    expect(s.markers).toEqual(["/"]);
    expect("marker" in s).toBe(false);
  });
  it("keeps only valid, unique marker characters and falls back when none remain", () => {
    expect(sanitizeSettings({ markers: ["/", "ab", 5, "/", "~"] }).markers).toEqual(["/", "~"]);
    expect(sanitizeSettings({ markers: [] }).markers).toEqual(["_"]);
    expect(sanitizeSettings({ markers: "/" }).markers).toEqual(["_"]);
  });
  it("hides markers by default", () => {
    expect(DEFAULT_SETTINGS.hideMarkers).toBe(true);
  });
});
