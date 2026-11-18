import { isValidMarker, MAX_MARKERS, SpanOptions } from "./spans";

export interface SquiggleSettings extends SpanOptions {
  folders: string[];
  /** Hide marker characters in Live Preview and Reading view (Live Preview shows them while the cursor is on them). */
  hideMarkers: boolean;
}

export const DEFAULT_SETTINGS: SquiggleSettings = {
  folders: [],
  marked: true,
  markers: ["_"],
  hideMarkers: true,
  bold: true,
  capitalized: true,
  spellcheckSentenceStart: false,
};

function sanitizeMarkers(r: Record<string, unknown>): string[] {
  const list: unknown[] = Array.isArray(r.markers) ? r.markers : typeof r.marker === "string" ? [r.marker] : [];
  const valid = [...new Set(list.filter((m): m is string => typeof m === "string" && isValidMarker(m)))];
  return valid.length > 0 ? valid.slice(0, MAX_MARKERS) : [...DEFAULT_SETTINGS.markers];
}

/**
 * Turns whatever was saved in data.json into valid settings: wrong types and invalid markers fall
 * back to defaults. Old settings are migrated: `underscore` becomes `marked`, `marker` becomes `markers`.
 */
export function sanitizeSettings(raw: unknown): SquiggleSettings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

  return {
    folders: Array.isArray(r.folders) ? r.folders.filter((f): f is string => typeof f === "string") : [],
    marked: bool(r.marked ?? r.underscore, DEFAULT_SETTINGS.marked),
    markers: sanitizeMarkers(r),
    hideMarkers: bool(r.hideMarkers, DEFAULT_SETTINGS.hideMarkers),
    bold: bool(r.bold, DEFAULT_SETTINGS.bold),
    capitalized: bool(r.capitalized, DEFAULT_SETTINGS.capitalized),
    spellcheckSentenceStart: bool(r.spellcheckSentenceStart, DEFAULT_SETTINGS.spellcheckSentenceStart),
  };
}
