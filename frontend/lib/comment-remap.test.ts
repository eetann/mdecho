import { describe, expect, test } from "bun:test";
import { remapComments, sliceLines } from "./comment-remap.ts";
import type { Comment } from "./types.ts";

function comment(startLine: number, endLine: number, text: string): Comment {
  return { startLine, endLine, text };
}

const OLD = ["# title", "", "first", "second", "third", "", "last"].join("\n");

describe("remapComments", () => {
  test("原文が同じなら何もしない", () => {
    const comments = new Map([["3-3", comment(3, 3, "A")]]);
    const result = remapComments(comments, OLD, OLD);
    expect(result.comments).toBe(comments);
    expect(result.outdated).toEqual([]);
  });

  test("上に行が増えたら、キーも行番号もずらして付け直す", () => {
    const next = ["# title", "", "added", "", "first", "second", "third", "", "last"].join("\n");
    const result = remapComments(
      new Map([
        ["3-4", comment(3, 4, "A")],
        ["5-5:1", comment(5, 5, "B")],
      ]),
      OLD,
      next,
    );
    expect(Array.from(result.comments.keys())).toEqual(["5-6", "7-7:1"]);
    expect(result.comments.get("5-6")).toEqual(comment(5, 6, "A"));
    expect(result.outdated).toEqual([]);
  });

  test("範囲内の行が書き換わったらoutdatedに回す", () => {
    const next = OLD.replace("second", "SECOND");
    const result = remapComments(
      new Map([
        ["3-4", comment(3, 4, "A")],
        ["7-7", comment(7, 7, "B")],
      ]),
      OLD,
      next,
    );
    expect(result.outdated).toEqual([comment(3, 4, "A")]);
    expect(Array.from(result.comments.keys())).toEqual(["7-7"]);
  });

  test("範囲内の行が消えたらoutdatedに回す", () => {
    const next = OLD.replace("third\n", "");
    const result = remapComments(new Map([["5-5", comment(5, 5, "A")]]), OLD, next);
    expect(result.outdated).toEqual([comment(5, 5, "A")]);
    expect(result.comments.size).toBe(0);
  });

  test("範囲の途中に行が挿入されたらoutdatedに回す", () => {
    const next = OLD.replace("first\n", "first\ninserted\n");
    const result = remapComments(new Map([["3-4", comment(3, 4, "A")]]), OLD, next);
    expect(result.outdated).toEqual([comment(3, 4, "A")]);
  });
});

describe("sliceLines", () => {
  test("指定した行範囲の原文を取り出す", () => {
    expect(sliceLines(OLD, 3, 4)).toBe("first\nsecond");
  });
});
