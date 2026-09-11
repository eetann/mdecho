import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { TableHandle } from "../hooks/useTableTools.ts";

/** 環境によって字形が無い記号(⤢など)を避けるため、拡大アイコンはSVGで描く。 */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
      <path d="M2 2h5v1.6H3.6V7H2V2zm7 0h5v5h-1.6V3.6H9V2zM2 9h1.6v3.4H7V14H2V9zm10.4 0H14v5H9v-1.6h3.4V9z" />
    </svg>
  );
}

function ColumnResizer({ handle, index }: { handle: TableHandle; index: number }) {
  const dragRef = useRef<{ x: number; width: number } | null>(null);

  function handlePointerDown(event: ReactPointerEvent<HTMLSpanElement>) {
    const cell = handle.headerCells[index];
    if (!cell) return;
    // ドラッグ中に本文が選択状態になるのを防ぐ
    event.preventDefault();
    dragRef.current = { x: event.clientX, width: cell.getBoundingClientRect().width };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLSpanElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    handle.setColumnWidth(index, drag.width + (event.clientX - drag.x));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLSpanElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <span
      className="mdecho-col-resizer"
      title="ドラッグで列幅を調整 / ダブルクリックで自動幅に戻す"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => handle.resetColumnWidth(index)}
    />
  );
}

function TableModal({ handle, onClose }: { handle: TableHandle; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const { wrap, scroll } = handle;

    // テーブルを抜き出しても本文の行位置がずれないよう、元の場所の高さを固定しておく
    wrap.style.height = `${wrap.offsetHeight}px`;
    body.append(scroll);
    handle.relayout();

    return () => {
      wrap.append(scroll);
      wrap.style.height = "";
      handle.relayout();
    };
  }, [handle]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  return (
    <div
      className="mdecho-table-modal fixed inset-0 z-40 flex flex-col bg-black/40 p-4 xl:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-box bg-base-100 shadow-xl">
        <div className="flex flex-none items-center justify-between gap-4 border-b border-base-300 px-4 py-2">
          <span className="text-sm text-base-content/60">
            列の境界をドラッグすると幅を変えられます
          </span>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            閉じる
          </button>
        </div>
        {/* テーブルのスタイルは .markdown-body の子孫セレクタで定義されているため、
            モーダル側にも同じクラスを付けて本文と同じ見た目を保つ。 */}
        <div
          ref={bodyRef}
          className="mdecho-table-modal-body markdown-body flex min-h-0 flex-1 flex-col p-4"
        />
      </div>
    </div>
  );
}

/**
 * useTableToolsが用意した各テーブルの外枠に、拡大ボタンと列幅つまみをportalでマウントし、
 * 拡大中はモーダルを描画する。テーブル本体のDOMは生成し直さず移動させるだけなので、
 * コメントやカーソル行の参照はそのまま生き続ける。
 */
export function TableTools({ tables }: { tables: TableHandle[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expanded = tables.find((table) => table.id === expandedId) ?? null;

  useEffect(() => {
    if (expandedId !== null && !expanded) setExpandedId(null);
  }, [expandedId, expanded]);

  return (
    <>
      {tables.map((table) =>
        createPortal(
          <button
            type="button"
            className="mdecho-table-expand btn btn-ghost btn-xs text-base-content/50 hover:text-base-content"
            aria-label="テーブルを拡大表示"
            onClick={() => setExpandedId(table.id)}
          >
            <ExpandIcon />
            拡大
          </button>,
          table.toolsHost,
          `tools-${table.id}`,
        ),
      )}
      {tables.flatMap((table) =>
        table.headerCells.map((cell, index) =>
          createPortal(
            <ColumnResizer handle={table} index={index} />,
            cell,
            `resizer-${table.id}-${index}`,
          ),
        ),
      )}
      {expanded && <TableModal handle={expanded} onClose={() => setExpandedId(null)} />}
    </>
  );
}
