/** Splits the settings textarea into folder entries: one per line, trimmed, blanks dropped. */
export function parseFolders(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * True when `path` (a vault-relative file path) is inside one of `folders`.
 * - Subfolders are included; matching is case-insensitive and path-segment aware.
 * - Stray leading/trailing slashes and backslashes in entries are ignored.
 * - The single entry "/" means the whole vault; blank entries are ignored,
 *   so an empty list matches nothing.
 */
export function isInFolders(path: string, folders: string[]): boolean {
  const target = path.replace(/\\/g, "/").toLowerCase();

  for (const raw of folders) {
    const entry = raw.trim().replace(/\\/g, "/");
    if (entry.length === 0) continue;

    const folder = entry.replace(/^\/+|\/+$/g, "").toLowerCase();
    if (folder.length === 0) return true; // entry was only slashes: whole vault

    if (target.startsWith(folder + "/")) return true;
  }
  return false;
}
