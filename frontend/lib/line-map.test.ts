import { describe, expect, test } from "bun:test";
import { mapLines } from "./line-map.ts";

describe("mapLines", () => {
  test("同じテキストはそのまま対応する", () => {
    expect(mapLines(["a", "b", "c"], ["a", "b", "c"])).toEqual([0, 1, 2]);
  });

  test("先頭に行が増えると、その分だけ後ろへずれる", () => {
    expect(mapLines(["a", "b"], ["x", "y", "a", "b"])).toEqual([2, 3]);
  });

  test("削除された行はnullになる", () => {
    expect(mapLines(["a", "b", "c"], ["a", "c"])).toEqual([0, null, 1]);
  });

  test("書き換えられた行はnullになる", () => {
    expect(mapLines(["a", "b", "c"], ["a", "B", "c"])).toEqual([0, null, 2]);
  });

  test("同じ内容の行が何度も出てきても、順序を保って対応させる", () => {
    expect(mapLines(["", "a", "", "b", ""], ["", "x", "", "a", "", "b", ""])).toEqual([
      0, 3, 4, 5, 6,
    ]);
  });

  test("中間部が大きすぎるときは、共通の先頭・末尾だけを対応させる", () => {
    const oldLines = ["head", ...Array.from({ length: 3000 }, (_, i) => `old${i}`), "tail"];
    const newLines = ["head", ...Array.from({ length: 3000 }, (_, i) => `new${i}`), "tail"];
    const result = mapLines(oldLines, newLines);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeNull();
    expect(result.at(-1)).toBe(newLines.length - 1);
  });
});
