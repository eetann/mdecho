import { MessageSquarePlus } from "lucide-react";
import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCommentHandle } from "../hooks/useCommentHandle.ts";
import { useCommentMarks } from "../hooks/useCommentMarks.ts";
import { useCursorLine } from "../hooks/useCursorLine.tsx";
import { findChangedMarks } from "../lib/changed-marks.ts";
import type { ChangedLineRange, Comment } from "../lib/types.ts";

/** コメントの範囲を示す縦棒の共通スタイル。吹き出しアイコンと本文の間に引く。 */
const MARK_BAR_CLASS =
  "mdecho-comment-mark pointer-events-none absolute right-[1.1em] w-[0.25em] rounded-full";

interface LineNumberEntry {
  line: string;
  /** 終わりの行。data-line-endを持たない要素(コードブロックの各行など)はlineと同じ */
  lineEnd: number;
  top: number;
  height: number;
  /** 行の頭から、本文の1行目の文字の中心までの距離。文字が無い要素(画像やhrなど)はnull */
  firstLineCenter: number | null;
  target: Element;
}

interface MarkBar {
  top: number;
  height: number;
}

/**
 * 要素の1行目に並ぶ文字の、縦方向の中心をビューポート座標で返す。
 * 要素の上端はline-heightの余白やpadding(表のセルなど)のぶん文字より上にあるため、
 * 行番号をそこに置くと文字より浮いて見える。
 */
function measureFirstLineCenter(target: Element): number | null {
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      // Mermaidの図の中の文字は図の途中にあるので、行の頭の目安にならない
      node.textContent?.trim() && !node.parentElement?.closest("svg")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const text = walker.nextNode();
  if (!text) return null;
  const range = document.createRange();
  range.selectNodeContents(text);
  const rect = range.getClientRects()[0];
  if (!rect || rect.height === 0) return null;
  return rect.top + rect.height / 2;
}

export function LineNumberGutter({
  markdownBodyRef,
  openEditor,
  comments,
  editing,
  activeKey,
  changedLines,
}: {
  markdownBodyRef: RefObject<HTMLElement | null>;
  openEditor: (startLine: number, endLine: number, sentenceIndex?: number) => void;
  comments: Map<string, Comment>;
  editing: Map<string, string>;
  activeKey: string | null;
  /** `--git`のbaseから追加・変更された行。空なら印を付けない */
  changedLines: ChangedLineRange[];
}) {
  const cursor = useCursorLine();
  const { targets, setCursorToElement } = cursor;
  const handle = useCommentHandle(cursor, openEditor);
  const { marks, activeMark } = useCommentMarks(cursor, comments, editing, activeKey);
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
          const line = target.getAttribute("data-line") ?? "";
          const center = measureFirstLineCenter(target);
          return {
            line,
            lineEnd: Number(target.getAttribute("data-line-end") ?? line),
            top: rect.top - gutterRect.top,
            height: rect.height,
            firstLineCenter: center === null ? null : center - rect.top,
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

  const changedMarks = useMemo(
    () =>
      changedLines.length === 0
        ? []
        : findChangedMarks(
            entries.map((entry) => ({ line: Number(entry.line), lineEnd: entry.lineEnd })),
            changedLines,
          ),
    [entries, changedLines],
  );

  /**
   * 変更の印の縦棒。子を持つ行(入れ子のリストを含むliなど)は子まで含んだ高さを持つため、
   * 次の行が始まる位置で切って、変わっていない子の横まで伸びないようにする。
   */
  function toChangedBar(startIndex: number, endIndex: number): MarkBar | null {
    const start = entries[startIndex];
    const end = entries[endIndex];
    if (!start || !end) return null;
    const next = entries[endIndex + 1];
    const endBottom = end.top + end.height;
    const bottom = next && next.top > end.top ? Math.min(endBottom, next.top) : endBottom;
    return { top: start.top, height: Math.max(bottom - start.top, 2) };
  }

  // 行番号と吹き出しを選択中の色にする範囲。ドラッグ中はそちらを優先する。
  const selected = handle.range ?? activeMark;
  const dragBar = handle.range && toBar(handle.range.startIndex, handle.range.endIndex);

  return (
    <div ref={gutterRef} className="mdecho-line-number-gutter relative w-[5em] flex-none">
      {/* gitの差分で追加・変更された行。コメントの縦棒より本文寄りに引く。 */}
      {changedMarks.map((mark) => {
        const bar = toChangedBar(mark.startIndex, mark.endIndex);
        if (!bar) return null;
        return (
          <div
            key={mark.startIndex}
            aria-hidden="true"
            title="gitの差分で追加・変更された行"
            className="mdecho-changed-mark absolute right-[0.35em] w-[0.2em] rounded-full bg-success/70"
            style={{ top: bar.top, height: bar.height }}
          />
        );
      })}
      {/* コメントが付いている行範囲。保存済みはコメント欄の枠線と同じ色で示す。 */}
      {marks.map((mark) => {
        const bar = toBar(mark.startIndex, mark.endIndex);
        if (!bar) return null;
        return (
          <div
            key={mark.key}
            aria-hidden="true"
            className={`${MARK_BAR_CLASS} ${
              editing.has(mark.key) ? "bg-primary" : "bg-warning/60"
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
            className="absolute right-[1.5em] left-0"
            style={{ top: entry.top, height: entry.height }}
          >
            {/* 本文の1行目の文字と高さが揃うよう、その中心を挟む帯の中で縦に中央寄せする。
                文字の無い要素は、これまでどおり要素の上端に揃える。 */}
            <div
              className={`flex gap-[0.4em] ${entry.firstLineCenter === null ? "items-start" : "items-center"}`}
              style={
                entry.firstLineCenter === null ? undefined : { height: entry.firstLineCenter * 2 }
              }
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
          </div>
        );
      })}
    </div>
  );
}
