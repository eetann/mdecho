import { describe, expect, test } from "bun:test";
import { buildToc } from "./toc.ts";

describe("buildToc", () => {
  test("returns an empty array when there are no source entries", () => {
    expect(buildToc([])).toEqual([]);
  });

  test("extracts headings and converts tag name to level", () => {
    const result = buildToc([
      { tagName: "H1", line: 1, text: "Title" },
      { tagName: "H2", line: 3, text: "Section" },
      { tagName: "H6", line: 10, text: "Deep" },
    ]);
    expect(result).toEqual([
      { level: 1, line: 1, text: "Title" },
      { level: 2, line: 3, text: "Section" },
      { level: 6, line: 10, text: "Deep" },
    ]);
  });

  test("filters out non-heading tags", () => {
    const result = buildToc([
      { tagName: "H1", line: 1, text: "Title" },
      { tagName: "P", line: 2, text: "paragraph" },
      { tagName: "LI", line: 3, text: "item" },
      { tagName: "TR", line: 4, text: "row" },
      { tagName: "HR", line: 5, text: "" },
    ]);
    expect(result).toEqual([{ level: 1, line: 1, text: "Title" }]);
  });

  test("preserves the original order of headings", () => {
    const result = buildToc([
      { tagName: "H2", line: 5, text: "B" },
      { tagName: "H1", line: 1, text: "A" },
    ]);
    expect(result.map((entry) => entry.text)).toEqual(["B", "A"]);
  });
});
