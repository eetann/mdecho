import { parseKey } from "./comment-keys.ts";
import { positionOfGroupIndex } from "./line-group.ts";

export interface CommentMark {
  key: string;
  startIndex: number;
  endIndex: number;
}

/**
 * コメントキー(startLine-endLine:sentenceIndex)を、行番号ガターが目印を描くための
 * cursor targetsのindex範囲へ変換する。
 * linesはDOM順(data-lineの昇順)に並んだ各targetのdata-line値。
 *
 * コメントはsessionStorageに行番号で保存されるため、描画時にはこうしてindexへ引き直す。
 */
export function resolveCommentMark(lines: readonly number[], key: string): CommentMark | null {
  const { startLine, endLine, sentenceIndex } = parseKey(key);
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return null;

  // 単一行のキーはsentenceIndexが開始=終了の位置を指すので、句点分割された文まで特定できる。
  if (startLine === endLine) {
    const position = positionOfGroupIndex(lines, startLine, sentenceIndex);
    return position === null ? null : { key, startIndex: position, endIndex: position };
  }

  // 複数行のキーのendLineはdata-line-end(終端要素がまたぐ最終行)なので、
  // そこにtargetがあるとは限らない。行番号で範囲に入るtargetを拾う。
  const startIndex = lines.findIndex((line) => line >= startLine);
  const startsAfterRange = (lines[startIndex] ?? Number.POSITIVE_INFINITY) > endLine;
  if (startIndex === -1 || startsAfterRange) return null;

  let endIndex = startIndex;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line > endLine) break;
    endIndex = i;
  }
  return { key, startIndex, endIndex };
}
