import { useEffect, useMemo } from "react";
import { type CommentMark, resolveCommentMark } from "../lib/comment-marks.ts";
import type { Comment } from "../lib/types.ts";
import type { CursorLineApi } from "./useCursorLine.tsx";

/** 編集中の範囲を本文側に伝えるための目印。styles.cssでハイライトする。 */
const ACTIVE_ATTR = "data-mdecho-comment-active";

export interface CommentMarksApi {
  /** 既存コメント(と編集中のコメント)が占める行範囲。 */
  marks: CommentMark[];
  /** いま編集中のコメントの行範囲。編集していなければnull。 */
  activeMark: CommentMark | null;
}

/**
 * コメントが「どの行に付いているか」をガターで示すための行範囲を求める。
 * あわせて、編集中のコメントの対象行を本文側でもハイライトする
 * (保存前に、いまどの行を選んだのかが分かるようにするため)。
 */
export function useCommentMarks(
  cursor: CursorLineApi,
  comments: Map<string, Comment>,
  editingKey: string | null,
): CommentMarksApi {
  const lines = useMemo(
    () => cursor.targets.map((el) => Number(el.getAttribute("data-line"))),
    [cursor.targets],
  );

  const marks = useMemo(() => {
    const keys = new Set(comments.keys());
    // 編集中のコメントはまだ保存されていないことがあるので、キー側から補う
    if (editingKey !== null) keys.add(editingKey);
    return Array.from(keys)
      .map((key) => resolveCommentMark(lines, key))
      .filter((mark) => mark !== null);
  }, [comments, editingKey, lines]);

  const activeMark = useMemo(
    () => (editingKey === null ? null : (marks.find((mark) => mark.key === editingKey) ?? null)),
    [marks, editingKey],
  );

  useEffect(() => {
    if (!activeMark) return;
    const highlighted = cursor.targets.slice(activeMark.startIndex, activeMark.endIndex + 1);
    for (const el of highlighted) el.setAttribute(ACTIVE_ATTR, "");
    return () => {
      for (const el of highlighted) el.removeAttribute(ACTIVE_ATTR);
    };
  }, [activeMark, cursor.targets]);

  return { marks, activeMark };
}
