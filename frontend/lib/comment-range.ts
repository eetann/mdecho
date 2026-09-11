import { groupIndexAt } from "./line-group.ts";

export interface CommentRange {
  startIndex: number;
  endIndex: number;
  startLine: number;
  endLine: number;
  sentenceIndex: number;
}

/**
 * 吹き出しハンドルのドラッグ開始位置(anchor)と現在位置(focus)から、コメントを開く行範囲を求める。
 * どちらもDOM順に並んだcursor targetsのindexで、上方向へのドラッグでも
 * startIndex <= endIndex になるよう並べ替える。
 *
 * linesは各targetのdata-line、lineEndsはdata-line-end(その要素が占める最終行)。
 */
export function resolveCommentRange(
  lines: readonly number[],
  lineEnds: readonly number[],
  anchorIndex: number,
  focusIndex: number,
): CommentRange | null {
  const startIndex = Math.min(anchorIndex, focusIndex);
  const endIndex = Math.max(anchorIndex, focusIndex);
  const startLine = lines[startIndex];
  if (startLine === undefined) return null;

  // 単一行のときはダブルクリックやEnterでの開始と同じキーになるようdata-lineだけを使う。
  // 複数行に広げたときだけ、終端要素が占める最終行(data-line-end)まで含める。
  const endLine =
    startIndex === endIndex ? lines[endIndex] : (lineEnds[endIndex] ?? lines[endIndex]);
  if (endLine === undefined) return null;

  return {
    startIndex,
    endIndex,
    startLine,
    endLine,
    // コメントスロットは終端行の直後に挿入されるため、文の位置も終端側に合わせる
    sentenceIndex: groupIndexAt(lines, endIndex),
  };
}
