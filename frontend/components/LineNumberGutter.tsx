import { MessageSquarePlus } from "lucide-react";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { useCommentHandle } from "../hooks/useCommentHandle.ts";
import { useCommentMarks } from "../hooks/useCommentMarks.ts";
import { useCursorLine } from "../hooks/useCursorLine.tsx";
import type { Comment } from "../lib/types.ts";

/** コメントの範囲を示す縦棒の共通スタイル。吹き出しアイコンと本文の間に引く。 */
const MARK_BAR_CLASS =
  "mdecho-comment-mark pointer-events-none absolute right-[1.1em] w-[0.25em] rounded-full";

interface LineNumberEntry {
  line: string;
  top: number;
  height: number;
  target: Element;
}

interface MarkBar {
  top: number;
  height: number;
}

export function LineNumberGutter({
  markdownBodyRef,
  openEditor,
  comments,
  editingKey,
}: {
  markdownBodyRef: RefObject<HTMLElement | null>;
  openEditor: (startLine: number, endLine: number, sentenceIndex?: number) => void;
  comments: Map<string, Comment>;
  editingKey: string | null;
}) {
  const cursor = useCursorLine();
  const { targets, setCursorToElement } = cursor;
  const handle = useCommentHandle(cursor, openEditor);
  const { marks, activeMark } = useCommentMarks(cursor, comments, editingKey);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<LineNumberEntry[]>([]);

  useLayoutEffect(() => {
    const gutter = gutterRef.current;
    const root = markdownBodyRef.current;
    if (!gutter || !root || targets.length === 0) {
      setEntries([]);
      return;
    }

    function render() {
      if (!gutter) return;
      const gutterRect = gutter.getBoundingClientRect();
      setEntries(
        targets.map((target) => {
          const rect = target.getBoundingClientRect();
          return {
            line: target.getAttribute("data-line") ?? "",
            top: rect.top - gutterRect.top,
            height: rect.height,
            target,
          };
        }),
      );
    }

    render();

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(root);
    window.addEventListener("resize", render);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", render);
    };
  }, [targets, markdownBodyRef]);

  /** 行範囲を、ガターに引く縦棒の位置と長さに変換する。 */
  function toBar(startIndex: number, endIndex: number): MarkBar | null {
    const start = entries[startIndex];
    const end = entries[endIndex];
    if (!start || !end) return null;
    // hrのように高さがほぼ無い行でも棒として見えるようにする
    return { top: start.top, height: Math.max(end.top + end.height - start.top, 2) };
  }

  // 行番号と吹き出しを選択中の色にする範囲。ドラッグ中はそちらを優先する。
  const selected = handle.range ?? activeMark;
  const dragBar = handle.range && toBar(handle.range.startIndex, handle.range.endIndex);

  return (
    <div ref={gutterRef} className="mdecho-line-number-gutter relative w-[5em] flex-none">
      {/* コメントが付いている行範囲。保存済みはコメント欄の枠線と同じ色で示す。 */}
      {marks.map((mark) => {
        const bar = toBar(mark.startIndex, mark.endIndex);
        if (!bar) return null;
        return (
          <div
            key={mark.key}
            aria-hidden="true"
            className={`${MARK_BAR_CLASS} ${
              mark.key === editingKey ? "bg-primary" : "bg-warning/60"
            }`}
            style={{ top: bar.top, height: bar.height }}
          />
        );
      })}
      {dragBar && (
        <div
          aria-hidden="true"
          className={`${MARK_BAR_CLASS} bg-primary`}
          style={{ top: dragBar.top, height: dragBar.height }}
        />
      )}
      {entries.map((entry, index) => {
        const inRange =
          selected !== null && index >= selected.startIndex && index <= selected.endIndex;
        const showHandle = handle.hoveredIndex === index || inRange;
        // 行の高さぶんの当たり判定を持たせて、本文から吹き出しへマウスを動かす間も表示が消えないようにする
        return (
          <div
            key={index}
            data-mdecho-gutter-index={index}
            className="absolute right-[1.5em] left-0 flex items-start gap-[0.4em]"
            style={{ top: entry.top, height: entry.height }}
          >
            <span
              className={`mdecho-line-number flex-1 cursor-pointer text-right font-mono text-[0.75em] whitespace-nowrap select-none ${
                inRange ? "text-primary" : "text-base-content/40 hover:text-base-content/60"
              }`}
              onClick={() => setCursorToElement(entry.target)}
            >
              {entry.line}
            </span>
            <button
              type="button"
              // ホバーしないと見えないボタンなので、キーボード移動の邪魔にならないよう外す
              // (キーボードからはカーソル行でEnterを押すとコメントを開始できる)
              tabIndex={-1}
              aria-label={`${entry.line}行目にコメントする`}
              title="クリックでコメント / 上下にドラッグで複数行を選択"
              className={`mdecho-comment-handle shrink-0 cursor-pointer touch-none transition ${
                showHandle ? "opacity-100" : "opacity-0"
              } ${inRange ? "text-primary" : "text-base-content/50 hover:text-primary"}`}
              onPointerDown={(event) => handle.startDrag(event, index)}
            >
              <MessageSquarePlus className="size-[1.1em]" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
