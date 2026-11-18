import { describe, it, expect } from "vitest";
import { isInFolders, parseFolders } from "../src/folders";

describe("isInFolders", () => {
  it("matches files inside a listed folder, including subfolders", () => {
    expect(isInFolders("Hinglish/a.md", ["Hinglish"])).toBe(true);
    expect(isInFolders("Hinglish/sub/b.md", ["Hinglish"])).toBe(true);
  });
  it("is path-segment aware", () => {
    expect(isInFolders("Hinglish2/a.md", ["Hinglish"])).toBe(false);
    expect(isInFolders("x/Hinglish/a.md", ["Hinglish"])).toBe(false);
    expect(isInFolders("Hinglish.md", ["Hinglish"])).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isInFolders("Hinglish/a.md", ["hinglish"])).toBe(true);
  });
  it("supports nested folders", () => {
    expect(isInFolders("Notes/Hinglish/a.md", ["Notes/Hinglish"])).toBe(true);
    expect(isInFolders("Notes/Other/a.md", ["Notes/Hinglish"])).toBe(false);
  });
  it("treats '/' as the whole vault", () => {
    expect(isInFolders("root.md", ["/"])).toBe(true);
    expect(isInFolders("any/where.md", ["/"])).toBe(true);
  });
  it("is inactive for an empty or blank list", () => {
    expect(isInFolders("a/b.md", [])).toBe(false);
    expect(isInFolders("a/b.md", ["", "   "])).toBe(false);
  });
  it("normalizes stray slashes and backslashes", () => {
    expect(isInFolders("Journal/x.md", ["/Journal/"])).toBe(true);
    expect(isInFolders("Journal/x.md", ["Journal\\"])).toBe(true);
  });
});

describe("parseFolders", () => {
  it("splits lines, trims, drops blanks", () => {
    expect(parseFolders("a\n\n  b/c \n")).toEqual(["a", "b/c"]);
  });
});
