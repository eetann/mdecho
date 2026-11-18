import type { ChangedLineRange } from "./types.ts";

/** ガターの1行が受け持つMarkdownの行。data-lineとdata-line-endの値 */
export interface LineSpan {
  line: number;
  lineEnd: number;
}

/** 印を付けるガター行の範囲(targetsのindex、両端を含む) */
export interface ChangedMark {
  startIndex: number;
  endIndex: number;
}

/**
 * 変更された行にかかるガター行を、連続するものをまとめて返す。spansはdata-line順に並んでいること。
 *
 * 子を持つ要素(入れ子のリストを含むliなど)は、data-line-endまで見ると子の変更でも印が付いてしまう。
 * そのため各行が受け持つのは、次の行が始まる手前までに切り詰める。
 */
export function findChangedMarks(
  spans: readonly LineSpan[],
  changed: readonly ChangedLineRange[],
): ChangedMark[] {
  const marks: ChangedMark[] = [];
  spans.forEach((span, index) => {
    const nextLine = spans.slice(index + 1).find((next) => next.line > span.line)?.line;
    const end = nextLine === undefined ? span.lineEnd : Math.min(span.lineEnd, nextLine - 1);
    // 同じ行に並ぶ文(句点分割)も、その行は受け持たせる。
    const ownEnd = Math.max(span.line, end);
    const isChanged = changed.some((range) => range.start <= ownEnd && span.line <= range.end);
    if (!isChanged) return;

    const last = marks.at(-1);
    if (last && last.endIndex === index - 1) {
      last.endIndex = index;
    } else {
      marks.push({ startIndex: index, endIndex: index });
    }
  });
  return marks;
}

/**
 * カーソル位置(targetsのindex)から、次(direction=1)または前(direction=-1)の変更の先頭を返す。
 * 無ければnull。カーソルが変更の途中にいるときに前へ戻ると、その変更の先頭へ行く。
 */
export function findChangeJump(
  marks: readonly ChangedMark[],
  cursorIndex: number,
  direction: 1 | -1,
): number | null {
  if (direction === 1) {
    return marks.find((mark) => mark.startIndex > cursorIndex)?.startIndex ?? null;
  }
  return marks.findLast((mark) => mark.startIndex < cursorIndex)?.startIndex ?? null;
}

/**
 * カーソルが何番目の変更にいるか(1始まり)。最初の変更より前なら0。
 * 変更と変更の間にいるときは、直前の変更の番号にする(「次へ」で番号が1つ進むように)。
 */
export function changePosition(marks: readonly ChangedMark[], cursorIndex: number): number {
  return marks.filter((mark) => mark.startIndex <= cursorIndex).length;
}
