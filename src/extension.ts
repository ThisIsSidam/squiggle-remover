import { editorInfoField, editorLivePreviewField } from "obsidian";
import { EditorState, Extension, Range, StateEffect } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { SquiggleSettings } from "./config";
import { isInFolders } from "./folders";
import { planLine, RangeKind } from "./ranges";

/** Dispatch this to an editor to make it re-read the settings and rebuild its decorations. */
export const refreshEffect = StateEffect.define<null>();

const decorationFor: Record<RangeKind, Decoration> = {
  // Chromium skips spellchecking inside elements marked spellcheck="false".
  spellcheck: Decoration.mark({ attributes: { spellcheck: "false" } }),
  // styles.css shows marked words plain (never italic), whatever marker character is used.
  marked: Decoration.mark({ class: "squiggle-remover-marked" }),
  hide: Decoration.replace({}),
};

const isLivePreview = (state: EditorState): boolean => state.field(editorLivePreviewField, false) === true;

export function squiggleExtension(getSettings: () => SquiggleSettings): Extension {
  class SquigglePlugin implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate): void {
      const refresh = update.transactions.some(
        (tr) => tr.reconfigured || tr.effects.some((e) => e.is(refreshEffect)),
      );
      // Moving the cursor matters because markers reappear while the cursor is on them.
      const cursorMoved = update.selectionSet && getSettings().hideMarkers;
      const modeChanged = isLivePreview(update.startState) !== isLivePreview(update.state);
      if (update.docChanged || update.viewportChanged || cursorMoved || refresh || modeChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const settings = getSettings();
      const path = view.state.field(editorInfoField, false)?.file?.path;
      if (!path || !isInFolders(path, settings.folders)) return Decoration.none;

      // Source mode always shows the raw text; only Live Preview hides markers.
      const hide = settings.hideMarkers && isLivePreview(view.state);
      const selection = view.state.selection.ranges;
      const isTouched = (from: number, to: number): boolean => selection.some((r) => r.from <= to && r.to >= from);

      const ranges: Range<Decoration>[] = [];
      const { doc } = view.state;
      let nextFrom = 0; // first position not yet scanned, so overlapping ranges never repeat a line
      for (const visible of view.visibleRanges) {
        let pos = Math.max(visible.from, nextFrom);
        while (pos <= visible.to) {
          const line = doc.lineAt(pos);
          for (const planned of planLine(line.text, line.from, settings, hide, isTouched)) {
            ranges.push(decorationFor[planned.kind].range(planned.from, planned.to));
          }
          pos = line.to + 1;
        }
        nextFrom = pos;
      }
      return Decoration.set(ranges, true);
    }
  }

  return ViewPlugin.fromClass(SquigglePlugin, { decorations: (plugin) => plugin.decorations });
}
