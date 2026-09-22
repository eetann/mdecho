import { describe, expect, test } from "bun:test";
import { buildToc } from "./toc.ts";

describe("buildToc", () => {
  test("returns an empty array when there are no source entries", () => {
    expect(buildToc([])).toEqual([]);
  });

  test("extracts headings and converts tag name to level", () => {
    const result = buildToc([
      { tagName: "H1", line: 1, text: "Title", id: "title" },
      { tagName: "H2", line: 3, text: "Section", id: "section" },
      { tagName: "H6", line: 10, text: "Deep", id: "deep" },
    ]);
    expect(result).toEqual([
      { level: 1, line: 1, text: "Title", id: "title" },
      { level: 2, line: 3, text: "Section", id: "section" },
      { level: 6, line: 10, text: "Deep", id: "deep" },
    ]);
  });

  test("filters out non-heading tags", () => {
    const result = buildToc([
      { tagName: "H1", line: 1, text: "Title", id: "title" },
      { tagName: "P", line: 2, text: "paragraph", id: "" },
      { tagName: "LI", line: 3, text: "item", id: "" },
      { tagName: "TR", line: 4, text: "row", id: "" },
      { tagName: "HR", line: 5, text: "", id: "" },
    ]);
    expect(result).toEqual([{ level: 1, line: 1, text: "Title", id: "title" }]);
  });

  test("preserves the original order of headings", () => {
    const result = buildToc([
      { tagName: "H2", line: 5, text: "B", id: "b" },
      { tagName: "H1", line: 1, text: "A", id: "a" },
    ]);
    expect(result.map((entry) => entry.text)).toEqual(["B", "A"]);
  });
});
