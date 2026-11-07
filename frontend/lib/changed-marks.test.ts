import { describe, expect, test } from "bun:test";
import { findChangedMarks } from "./changed-marks.ts";

describe("findChangedMarks", () => {
  test("変更行にかかるガター行を、連続するものはまとめて返す", () => {
    const spans = [
      { line: 1, lineEnd: 1 },
      { line: 3, lineEnd: 4 },
      { line: 6, lineEnd: 6 },
      { line: 8, lineEnd: 8 },
    ];

    expect(findChangedMarks(spans, [{ start: 4, end: 6 }])).toEqual([
      { startIndex: 1, endIndex: 2 },
    ]);
    expect(
      findChangedMarks(spans, [
        { start: 1, end: 1 },
        { start: 8, end: 9 },
      ]),
    ).toEqual([
      { startIndex: 0, endIndex: 0 },
      { startIndex: 3, endIndex: 3 },
    ]);
  });

  test("ブロックの間の空行だけが変わったときは印を付けない", () => {
    const spans = [
      { line: 1, lineEnd: 1 },
      { line: 3, lineEnd: 3 },
    ];

    expect(findChangedMarks(spans, [{ start: 2, end: 2 }])).toEqual([]);
  });

  test("入れ子のリストの子だけが変わったとき、親のliには印を付けない", () => {
    // - 親(1行目)
    //   - 子(2行目)
    const spans = [
      { line: 1, lineEnd: 2 },
      { line: 2, lineEnd: 2 },
    ];

    expect(findChangedMarks(spans, [{ start: 2, end: 2 }])).toEqual([
      { startIndex: 1, endIndex: 1 },
    ]);
  });

  test("同じ行に並ぶ文は、その行が変わればすべてに印を付ける", () => {
    const spans = [
      { line: 1, lineEnd: 1 },
      { line: 1, lineEnd: 1 },
      { line: 2, lineEnd: 2 },
    ];

    expect(findChangedMarks(spans, [{ start: 1, end: 1 }])).toEqual([
      { startIndex: 0, endIndex: 1 },
    ]);
  });
});
