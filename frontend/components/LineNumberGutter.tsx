import { MessageSquarePlus } from "lucide-react";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { useCommentHandle } from "../hooks/useCommentHandle.ts";
import { useCursorLine } from "../hooks/useCursorLine.tsx";

interface LineNumberEntry {
  line: string;
  top: number;
  height: number;
  target: Element;
}

export function LineNumberGutter({
  markdownBodyRef,
  openEditor,
}: {
  markdownBodyRef: RefObject<HTMLElement | null>;
  openEditor: (startLine: number, endLine: number, sentenceIndex?: number) => void;
}) {
  const cursor = useCursorLine();
  const { targets, setCursorToElement } = cursor;
  const handle = useCommentHandle(cursor, openEditor);
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

  return (
    <div ref={gutterRef} className="mdecho-line-number-gutter relative w-[4.5em] flex-none">
      {entries.map((entry, index) => {
        const inRange =
          handle.range !== null &&
          index >= handle.range.startIndex &&
          index <= handle.range.endIndex;
        const showHandle = handle.hoveredIndex === index || inRange;
        // 行の高さぶんの当たり判定を持たせて、本文から吹き出しへマウスを動かす間も表示が消えないようにする
        return (
          <div
            key={index}
            data-mdecho-gutter-index={index}
            className="absolute right-[1.1em] left-0 flex items-start gap-[0.4em]"
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
