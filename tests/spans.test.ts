import { describe, it, expect } from "vitest";
import { findMarked, findSpans, isValidMarker, MAX_LINE_LENGTH, parseMarkers, SpanOptions, stripMarkers } from "../src/spans";

const OFF: SpanOptions = { marked: false, markers: ["_"], bold: false, capitalized: false, spellcheckSentenceStart: false };
const texts = (line: string, o: Partial<SpanOptions>) =>
  findSpans(line, { ...OFF, ...o }).map((s) => line.slice(s.from, s.to));

describe("marked spans (default marker _)", () => {
  const u = { marked: true };
  it("marks inner text of _word_ and multi-word phrases", () => {
    expect(texts("_aaj_ main office", u)).toEqual(["aaj"]);
    expect(texts("_aaj office ja raha hoon_ kal", u)).toEqual(["aaj office ja raha hoon"]);
    expect(texts("a _b_ c _d_", u)).toEqual(["b", "d"]);
  });
  it("ignores identifiers and dunders", () => {
    expect(texts("use snake_case_name here", u)).toEqual([]);
    expect(texts("__init__", u)).toEqual([]);
  });
  it("ignores unmatched or space-padded markers", () => {
    expect(texts("_open without close", u)).toEqual([]);
    expect(texts("_ not a span _", u)).toEqual([]);
  });
  it("respects the toggle", () => {
    expect(texts("_aaj_", {})).toEqual([]);
  });
});

describe("bold spans", () => {
  const b = { bold: true };
  it("marks inner text of **x** and __x__", () => {
    expect(texts("**Rahul ji** aaye", b)).toEqual(["Rahul ji"]);
    expect(texts("__init__", b)).toEqual(["init"]);
  });
  it("ignores unmatched markers and respects the toggle", () => {
    expect(texts("** open", b)).toEqual([]);
    expect(texts("**x**", {})).toEqual([]);
  });
});

describe("long lines", () => {
  it("returns nothing for lines over MAX_LINE_LENGTH", () => {
    const line = "** a ".repeat(Math.ceil(MAX_LINE_LENGTH / 5) + 1);
    expect(line.length).toBeGreaterThan(MAX_LINE_LENGTH);
    expect(findSpans(line, { ...OFF, bold: true, marked: true, capitalized: true })).toEqual([]);
  });
});

const ALL: SpanOptions = { marked: true, markers: ["_"], bold: true, capitalized: true, spellcheckSentenceStart: false };

describe("capitalized words", () => {
  const c = { capitalized: true };
  it("exempts every capitalized word by default, including the first", () => {
    expect(texts("Mera naam Rahul hai", c)).toEqual(["Mera", "Rahul"]);
  });
  it("ignores lowercase-first words", () => {
    expect(texts("iPhone aur kal", c)).toEqual([]);
    expect(texts("McDonald gaya", c)).toEqual(["McDonald"]);
  });
  it("can still spellcheck sentence-initial words", () => {
    const s = { capitalized: true, spellcheckSentenceStart: true };
    expect(texts("Mera naam Rahul hai", s)).toEqual(["Rahul"]);
    expect(texts("kal Rahul aaya. Priya bhi", s)).toEqual(["Rahul"]);
    expect(texts("- Rahul aaya", s)).toEqual([]);
    expect(texts("> Rahul aaya", s)).toEqual([]);
    expect(texts("1. Rahul aaya", s)).toEqual([]);
    expect(texts("## Rahul aaya", s)).toEqual([]);
  });
  it("handles non-ASCII and uncased scripts", () => {
    expect(texts("Émile aur Ñandú", c)).toEqual(["Émile", "Ñandú"]);
    expect(texts("नमस्ते दोस्त", c)).toEqual([]);
  });
  it("handles apostrophes", () => {
    expect(texts("O'Brien ka ghar", c)).toEqual(["O'Brien"]);
    expect(texts("kal 'Rahul' ne kaha", c)).toEqual(["Rahul"]);
    expect(texts("kal Rahul's ghar", c)).toEqual(["Rahul's"]);
  });
});

describe("merging", () => {
  it("returns sorted, disjoint spans for nested matches", () => {
    const line = "**Rahul _ji_ aaya** aur _Priya_";
    const spans = findSpans(line, ALL);
    expect(spans.map((s) => line.slice(s.from, s.to))).toEqual(["Rahul _ji_ aaya", "Priya"]);
    for (let i = 1; i < spans.length; i++) expect(spans[i].from).toBeGreaterThan(spans[i - 1].to);
  });
  it("returns [] when every rule is off", () => {
    expect(findSpans("_a_ **b** C", OFF)).toEqual([]);
  });
});

describe("custom marker", () => {
  const slash = { marked: true, markers: ["/"] };
  it("marks text wrapped in the custom marker, and no longer in underscores", () => {
    expect(texts("mujhe /kal office/ jana", slash)).toEqual(["kal office"]);
    expect(texts("a /b/ c /d/", slash)).toEqual(["b", "d"]);
    expect(texts("_aaj_ main", slash)).toEqual([]);
  });
  it("ignores the marker inside words, URLs and unmatched markers", () => {
    expect(texts("and/or kya", slash)).toEqual([]);
    expect(texts("https://example.com/a/b", slash)).toEqual([]);
    expect(texts("/open without close", slash)).toEqual([]);
    expect(texts("/ not a span /", slash)).toEqual([]);
  });
  it.each(["*", "|", "^", "$", ".", "+", "?", "(", ")", "[", "]", "{", "}", "\\", "~", "=", "-", "/", "\u{1F642}"])(
    "treats regex-special or unusual marker %s literally",
    (m) => {
      expect(texts(`x ${m}aaj bhai${m} y`, { marked: true, markers: [m] })).toEqual(["aaj bhai"]);
    },
  );
  it("does not confuse a * marker with **bold**", () => {
    expect(texts("*aaj* aur **bold**", { marked: true, markers: ["*"] })).toEqual(["aaj"]);
  });
  it("keeps bold rules independent of the marker", () => {
    expect(texts("__init__ aur **x**", { bold: true, markers: ["/"] })).toEqual(["init", "x"]);
  });
  it("skips the marked rule when the marker is invalid", () => {
    expect(texts("xabaajabx", { marked: true, markers: ["ab"] })).toEqual([]);
    expect(texts("_aaj_", { marked: true, markers: [""] })).toEqual([]);
  });
});

describe("isValidMarker", () => {
  it.each(["_", "/", "*", "~", "|", "=", "^", "$", "+", "\u{1F642}"])("accepts %s", (m) => {
    expect(isValidMarker(m)).toBe(true);
  });
  it.each(["", "a", "É", "5", " ", "\n", "//", "ab", "_ "])("rejects %j", (m) => {
    expect(isValidMarker(m)).toBe(false);
  });
});

describe("multiple markers at once", () => {
  const both = { marked: true, markers: ["/", "~"] };
  it("marks text wrapped in any configured marker", () => {
    expect(texts("a /b/ ~c d~ e", both)).toEqual(["b", "c d"]);
  });
  it("handles markers nested inside each other", () => {
    expect(texts("/aaj ~kal~ hai/", both)).toEqual(["aaj ~kal~ hai"]);
  });
  it("matches nothing when the list is empty", () => {
    expect(texts("/a/", { marked: true, markers: [] })).toEqual([]);
  });
  it("ignores invalid entries but keeps valid ones", () => {
    expect(texts("/a/ xbx", { marked: true, markers: ["ab", "/"] })).toEqual(["a"]);
  });
});

describe("findMarked", () => {
  it("returns marker, opening marker, inner text and closing marker offsets", () => {
    expect(findMarked("a /bc/ d", ["/"])).toEqual([
      { marker: "/", open: { from: 2, to: 3 }, inner: { from: 3, to: 5 }, close: { from: 5, to: 6 } },
    ]);
  });
  it("counts non-BMP markers in UTF-16 units", () => {
    expect(findMarked("\u{1F642}x\u{1F642}", ["\u{1F642}"])).toEqual([
      { marker: "\u{1F642}", open: { from: 0, to: 2 }, inner: { from: 2, to: 3 }, close: { from: 3, to: 5 } },
    ]);
  });
  it("sorts matches of different markers by position", () => {
    const found = findMarked("~a~ /b/", ["/", "~"]);
    expect(found.map((f) => f.marker)).toEqual(["~", "/"]);
  });
  it("returns nothing for over-long lines", () => {
    expect(findMarked("/a/ ".repeat(MAX_LINE_LENGTH), ["/"])).toEqual([]);
  });
});

describe("stripMarkers", () => {
  it("removes the marker characters but keeps the text", () => {
    expect(stripMarkers("mujhe /kal office/ jana", ["/"])).toBe("mujhe kal office jana");
    expect(stripMarkers("and/or /x/ ~y~", ["/", "~"])).toBe("and/or x y");
  });
  it("leaves URLs, unmatched markers and other lines alone", () => {
    expect(stripMarkers("https://a.com/b/c", ["/"])).toBe("https://a.com/b/c");
    expect(stripMarkers("/open", ["/"])).toBe("/open");
    expect(stripMarkers("plain text", [])).toBe("plain text");
  });
  it("handles non-BMP markers", () => {
    expect(stripMarkers("a \u{1F642}b\u{1F642} c", ["\u{1F642}"])).toBe("a b c");
  });
});

describe("parseMarkers", () => {
  it("splits into unique valid characters, ignoring whitespace", () => {
    expect(parseMarkers("/")).toEqual(["/"]);
    expect(parseMarkers("/~|")).toEqual(["/", "~", "|"]);
    expect(parseMarkers(" / ~ ")).toEqual(["/", "~"]);
    expect(parseMarkers("//")).toEqual(["/"]);
    expect(parseMarkers("\u{1F642}/")).toEqual(["\u{1F642}", "/"]);
  });
  it("rejects empty input, letters/digits, and more than 8 markers", () => {
    expect(parseMarkers("")).toBeNull();
    expect(parseMarkers("   ")).toBeNull();
    expect(parseMarkers("a/")).toBeNull();
    expect(parseMarkers("5")).toBeNull();
    expect(parseMarkers("/~|=^$+<>")).toBeNull();
  });
});
