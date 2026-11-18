import { MarkdownView, Plugin } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { DEFAULT_SETTINGS, sanitizeSettings, SquiggleSettings } from "./config";
import { refreshEffect, squiggleExtension } from "./extension";
import { isInFolders } from "./folders";
import { stripMarkersInElement } from "./reading";
import { SettingsHost, SquiggleSettingTab } from "./settings";

export default class SquiggleRemoverPlugin extends Plugin implements SettingsHost {
  settings: SquiggleSettings = { ...DEFAULT_SETTINGS, folders: [], markers: [...DEFAULT_SETTINGS.markers] };

  async onload(): Promise<void> {
    this.settings = sanitizeSettings(await this.loadData());

    this.addSettingTab(new SquiggleSettingTab(this));
    this.registerEditorExtension(squiggleExtension(() => this.settings));

    // Reading view: hide the marker characters in the rendered text.
    this.registerMarkdownPostProcessor((el, ctx) => {
      const s = this.settings;
      if (!s.marked || !s.hideMarkers || !isInFolders(ctx.sourcePath, s.folders)) return;
      stripMarkersInElement(el, s.markers);
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshEditors();
  }

  /** Makes every open markdown editor re-read the settings. */
  refreshEditors(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const cm = (leaf.view.editor as unknown as { cm?: EditorView }).cm;
        cm?.dispatch({ effects: refreshEffect.of(null) });
      }
    });
  }
}
