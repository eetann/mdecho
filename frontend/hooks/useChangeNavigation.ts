import { useCallback, useEffect, useMemo } from "react";
import {
  changePosition,
  type ChangedMark,
  findChangeJump,
  findChangedMarks,
} from "../lib/changed-marks.ts";
import { getOpenTableModal, isDialogOpen } from "../lib/modal.ts";
import type { ChangedLineRange } from "../lib/types.ts";
import { isEditableTarget, useCursorIndex, useCursorLine } from "./useCursorLine.tsx";

/** gitの差分で変わった箇所を、ガターの印と同じ単位(targetsのindexの範囲)でまとめて返す */
export function useChangedMarks(changedLines: readonly ChangedLineRange[]): ChangedMark[] {
  const { targets } = useCursorLine();
  return useMemo(
    () =>
      changedLines.length === 0
        ? []
        : findChangedMarks(
            targets.map((target) => {
              const line = Number(target.getAttribute("data-line"));
              return { line, lineEnd: Number(target.getAttribute("data-line-end") ?? line) };
            }),
            changedLines,
          ),
    [targets, changedLines],
  );
}

export interface ChangeNavigation {
  /** カーソルが何番目の変更にいるか(1始まり)。最初の変更より前なら0 */
  position: number;
  /** 前・次の向きに飛べる変更があるか */
  canJump: { prev: boolean; next: boolean };
  /** 次(1)または前(-1)の変更へカーソルを移す。その向きに変更が無ければ何もしない */
  jump: (direction: 1 | -1) => void;
}

/**
 * 変更箇所をn/Nキー(とツールバーのボタン)で行き来する。
 * 変更を探してスクロールし続けなくて済むようにするためのもの。
 * キーを奪うので、変更箇所を行き来できる画面でだけ呼ぶこと。
 */
export function useChangeNavigation(marks: readonly ChangedMark[]): ChangeNavigation {
  const { getCursorIndex, jumpToIndex } = useCursorLine();
  const cursorIndex = useCursorIndex();

  const jump = useCallback(
    (direction: 1 | -1) => {
      const index = findChangeJump(marks, getCursorIndex(), direction);
      if (index !== null) jumpToIndex(index);
    },
    [marks, getCursorIndex, jumpToIndex],
  );

  useEffect(() => {
    if (marks.length === 0) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(document.activeElement)) return;
      // 表の拡大表示の外へは飛べない(裏に隠れていて見えない)ので、開いている間は止める
      if (isDialogOpen() || getOpenTableModal()) return;

      if (event.key === "n") {
        event.preventDefault();
        jump(1);
      } else if (event.key === "N") {
        event.preventDefault();
        jump(-1);
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [marks, jump]);

  return {
    position: changePosition(marks, cursorIndex),
    canJump: {
      prev: findChangeJump(marks, cursorIndex, -1) !== null,
      next: findChangeJump(marks, cursorIndex, 1) !== null,
    },
    jump,
  };
}
