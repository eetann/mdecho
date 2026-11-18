import { describe, expect, test } from "bun:test";
import { changePosition, findChangeJump, findChangedMarks } from "./changed-marks.ts";

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

describe("findChangeJump", () => {
  const marks = [
    { startIndex: 2, endIndex: 4 },
    { startIndex: 8, endIndex: 8 },
  ];

  test("次の変更の先頭へ進む", () => {
    expect(findChangeJump(marks, 0, 1)).toBe(2);
    expect(findChangeJump(marks, 2, 1)).toBe(8);
    expect(findChangeJump(marks, 3, 1)).toBe(8);
    expect(findChangeJump(marks, 8, 1)).toBeNull();
  });

  test("前の変更の先頭へ戻る。変更の途中からならその先頭へ", () => {
    expect(findChangeJump(marks, 10, -1)).toBe(8);
    expect(findChangeJump(marks, 8, -1)).toBe(2);
    expect(findChangeJump(marks, 3, -1)).toBe(2);
    expect(findChangeJump(marks, 2, -1)).toBeNull();
  });

  test("変更が無ければnull", () => {
    expect(findChangeJump([], 0, 1)).toBeNull();
    expect(findChangeJump([], 0, -1)).toBeNull();
  });
});

describe("changePosition", () => {
  const marks = [
    { startIndex: 2, endIndex: 4 },
    { startIndex: 8, endIndex: 8 },
  ];

  test("カーソルがいる、または直前にある変更の番号を返す", () => {
    expect(changePosition(marks, 0)).toBe(0);
    expect(changePosition(marks, 2)).toBe(1);
    expect(changePosition(marks, 5)).toBe(1);
    expect(changePosition(marks, 8)).toBe(2);
    expect(changePosition(marks, 20)).toBe(2);
  });
});
