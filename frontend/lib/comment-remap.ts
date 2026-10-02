import { keyOf, parseKey } from "./comment-keys.ts";
import { mapLines } from "./line-map.ts";
import type { Comment } from "./types.ts";

export function splitLines(source: string): string[] {
  return source.split(/\r?\n/);
}

/** startLine〜endLine(1始まり、両端を含む)の原文を取り出す */
export function sliceLines(source: string, startLine: number, endLine: number): string {
  return splitLines(source)
    .slice(startLine - 1, endLine)
    .join("\n");
}

/** 旧startLine〜endLineの各行が、すべて同じだけずれた位置にそのまま残っているか */
function isShiftedIntact(
  lineMap: readonly (number | null)[],
  startLine: number,
  endLine: number,
  offset: number,
): boolean {
  for (let line = startLine; line <= endLine; line++) {
    if (lineMap[line - 1] !== line - 1 + offset) return false;
  }
  return true;
}

export interface RemapResult {
  comments: Map<string, Comment>;
  /** 範囲内の行が削除・変更されて、付け先を失ったコメント(行番号は旧テキストのまま) */
  outdated: Comment[];
}

/**
 * 旧テキストに付けたコメントを、新テキストの行番号へ付け替える。
 * 範囲内の行がすべて変更されずに残り、しかも途中に行が挿入されていなければ付け替える。
 * それ以外は、指摘した箇所が書き換わったとみなしてoutdatedに回す。
 */
export function remapComments(
  comments: Map<string, Comment>,
  oldSource: string,
  newSource: string,
): RemapResult {
  if (oldSource === newSource) return { comments, outdated: [] };

  const lineMap = mapLines(splitLines(oldSource), splitLines(newSource));
  const next = new Map<string, Comment>();
  const outdated: Comment[] = [];

  for (const [key, comment] of comments) {
    const { startLine, endLine, sentenceIndex } = parseKey(key);
    const newStart = lineMap[startLine - 1];
    if (newStart === null || newStart === undefined) {
      outdated.push(comment);
      continue;
    }
    const offset = newStart + 1 - startLine;
    if (!isShiftedIntact(lineMap, startLine, endLine, offset)) {
      outdated.push(comment);
      continue;
    }
    next.set(keyOf(startLine + offset, endLine + offset, sentenceIndex), {
      ...comment,
      startLine: comment.startLine + offset,
      endLine: comment.endLine + offset,
    });
  }
  return { comments: next, outdated };
}
