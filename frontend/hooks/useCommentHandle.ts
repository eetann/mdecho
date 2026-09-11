import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { resolveCommentRange } from "../lib/comment-range.ts";
import type { CursorLineApi } from "./useCursorLine.tsx";

/** ドラッグ中の範囲を本文側に伝えるための目印。styles.cssでハイライトする。 */
const RANGE_ATTR = "data-mdecho-comment-range";
/** LineNumberGutterが各行に付与する、cursor targetsのindex。 */
const GUTTER_INDEX_ATTR = "data-mdecho-gutter-index";

interface DragState {
  anchorIndex: number;
  focusIndex: number;
  pointerId: number;
}

export interface IndexRange {
  startIndex: number;
  endIndex: number;
}

export interface CommentHandleApi {
  /** 吹き出しを表示すべき行(cursor targetsのindex)。 */
  hoveredIndex: number | null;
  /** ドラッグ中に選択されている行範囲。ドラッグしていなければnull。 */
  range: IndexRange | null;
  startDrag: (event: ReactPointerEvent<HTMLElement>, index: number) => void;
}

/**
 * 行ガターの吹き出しハンドルの状態を扱う。
 * 本文・ガターどちらにマウスがあるかを1つのpointeroverで判定してホバー行を決め、
 * 吹き出しからのドラッグでは通過した行を範囲としてハイライトし、離した時点でコメントを開く。
 */
export function useCommentHandle(
  cursor: CursorLineApi,
  openEditor: (startLine: number, endLine: number, sentenceIndex?: number) => void,
): CommentHandleApi {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [range, setRange] = useState<IndexRange | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const { lines, lineEnds } = useMemo(
    () => ({
      lines: cursor.targets.map((el) => Number(el.getAttribute("data-line"))),
      lineEnds: cursor.targets.map((el) =>
        Number(el.getAttribute("data-line-end") ?? el.getAttribute("data-line")),
      ),
    }),
    [cursor.targets],
  );

  const indexOfElement = useCallback(
    (el: Element | null): number | null => {
      if (!el) return null;
      const gutterLine = el.closest(`[${GUTTER_INDEX_ATTR}]`);
      if (gutterLine) {
        const index = Number(gutterLine.getAttribute(GUTTER_INDEX_ATTR));
        return Number.isInteger(index) ? index : null;
      }
      const target = cursor.getTargetForElement(el);
      if (!target) return null;
      const index = cursor.targets.indexOf(target);
      return index === -1 ? null : index;
    },
    [cursor],
  );

  useEffect(() => {
    function handlePointerOver(event: PointerEvent) {
      // ドラッグ中はアンカー行に吹き出しを出したままにする
      if (dragRef.current) return;
      setHoveredIndex(indexOfElement(event.target as Element | null));
    }

    document.addEventListener("pointerover", handlePointerOver);
    return () => document.removeEventListener("pointerover", handlePointerOver);
  }, [indexOfElement]);

  const startDrag = useCallback((event: ReactPointerEvent<HTMLElement>, index: number) => {
    // ドラッグ中に本文が選択状態になるのを防ぐ
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { anchorIndex: index, focusIndex: index, pointerId: event.pointerId };
    setHoveredIndex(index);
    setRange({ startIndex: index, endIndex: index });
  }, []);

  const isDragging = range !== null;

  useEffect(() => {
    if (!isDragging) return;

    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      // ポインタはハンドルにキャプチャされているため、event.targetではなく実際の座標から行を引く
      const index = indexOfElement(document.elementFromPoint(event.clientX, event.clientY));
      if (index === null || index === drag.focusIndex) return;
      drag.focusIndex = index;
      setRange({
        startIndex: Math.min(drag.anchorIndex, index),
        endIndex: Math.max(drag.anchorIndex, index),
      });
    }

    function finishDrag(event: PointerEvent, commit: boolean) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setRange(null);
      if (!commit) return;

      const resolved = resolveCommentRange(lines, lineEnds, drag.anchorIndex, drag.focusIndex);
      if (!resolved) return;
      const startTarget = cursor.targets[resolved.startIndex];
      if (startTarget) cursor.setCursorToElement(startTarget);
      openEditor(resolved.startLine, resolved.endLine, resolved.sentenceIndex);
    }

    function handlePointerUp(event: PointerEvent) {
      finishDrag(event, true);
    }

    function handlePointerCancel(event: PointerEvent) {
      finishDrag(event, false);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [isDragging, indexOfElement, lines, lineEnds, cursor, openEditor]);

  useEffect(() => {
    if (!range) return;
    const highlighted = cursor.targets.slice(range.startIndex, range.endIndex + 1);
    for (const el of highlighted) el.setAttribute(RANGE_ATTR, "");
    return () => {
      for (const el of highlighted) el.removeAttribute(RANGE_ATTR);
    };
  }, [range, cursor.targets]);

  return { hoveredIndex, range, startDrag };
}
