import { stripMarkers } from "./spans";

// Never touch code, math or embedded editors.
const SKIP_SELECTOR = "code, pre, script, style, .math, .cm-editor";

/**
 * Reading view: removes the marker characters from the rendered text (display only; the note file is
 * unchanged). Works per line inside a single text node, so a marked phrase that is split across
 * elements (e.g. contains **bold**) keeps its markers.
 */
export function stripMarkersInElement(root: HTMLElement, markers: readonly string[]): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);

  for (const node of nodes) {
    if (node.parentElement?.closest(SKIP_SELECTOR)) continue;
    const value = node.nodeValue ?? "";
    const next = value
      .split("\n")
      .map((line) => stripMarkers(line, markers))
      .join("\n");
    if (next !== value) node.nodeValue = next;
  }
}
