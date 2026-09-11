import { type RefObject, useLayoutEffect, useState } from "react";
import { allocateColumnWidths, MIN_COLUMN_WIDTH, pickFontScale } from "../lib/table-layout.ts";

const STORAGE_KEY = "mdecho:tableColumnWidths";

export interface TableHandle {
  id: string;
  /** テーブルを包む外枠。拡大中に高さを固定してページのレイアウトずれを防ぐ */
  wrap: HTMLElement;
  /** 横スクロールを担当する要素。拡大時はこれごとモーダルへ移動する */
  scroll: HTMLElement;
  /** 拡大ボタンをportalでマウントするための空div */
  toolsHost: HTMLElement;
  /** 列幅ドラッグのつまみをportalでマウントするためのヘッダーセル */
  headerCells: HTMLTableCellElement[];
  /** 現在のコンテナ幅に合わせてカラム幅とフォントサイズを計算し直す */
  relayout: () => void;
  setColumnWidth: (index: number, width: number) => void;
  resetColumnWidth: (index: number) => void;
}

interface TableParts {
  id: string;
  wrap: HTMLElement;
  scroll: HTMLElement;
  toolsHost: HTMLElement;
  table: HTMLTableElement;
  colgroup: HTMLElement;
  cols: HTMLElement[];
  headerCells: HTMLTableCellElement[];
  /** 手動リサイズされたカラムの幅。未リサイズはnullで自動幅を使う */
  manualWidths: (number | null)[];
  /** 自動計算されたカラム幅 */
  autoWidths: number[];
  /** テーブルに適用するfont-size(等倍なら空文字) */
  fontSize: string;
  /** 直近に自動計算を行ったときのコンテナ幅。ResizeObserverの無駄打ちを防ぐ */
  lastAvailable: number;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function readStoredWidths(id: string, columnCount: number): (number | null)[] {
  const fallback: (number | null)[] = Array.from({ length: columnCount }, () => null);
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const stored: unknown = (parsed as Record<string, unknown>)[id];
    // カラム数が変わっている(Markdown側が編集された)場合は復元しない
    if (!Array.isArray(stored) || stored.length !== columnCount) return fallback;
    return stored.map((value: unknown) => (typeof value === "number" && value > 0 ? value : null));
  } catch {
    return fallback;
  }
}

function writeStoredWidths(id: string, widths: readonly (number | null)[]): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const store =
      typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    store[id] = widths;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // sessionStorageが使えない環境(プライベートブラウジング等)は無視
  }
}

function wrapTable(table: HTMLTableElement, id: string): TableParts | null {
  const headerRow = table.tHead?.rows[0];
  const parent = table.parentElement;
  if (!headerRow || !parent) return null;

  const headerCells = Array.from(headerRow.cells);
  const wrap = document.createElement("div");
  wrap.className = "mdecho-table-wrap";
  const toolsHost = document.createElement("div");
  toolsHost.className = "mdecho-table-tools";
  const scroll = document.createElement("div");
  scroll.className = "mdecho-table-scroll";

  parent.insertBefore(wrap, table);
  wrap.append(toolsHost, scroll);
  scroll.append(table);

  const colgroup = document.createElement("colgroup");
  const cols = headerCells.map(() => document.createElement("col"));
  colgroup.append(...cols);
  table.prepend(colgroup);

  return {
    id,
    wrap,
    scroll,
    toolsHost,
    table,
    colgroup,
    cols,
    headerCells,
    manualWidths: readStoredWidths(id, headerCells.length),
    autoWidths: [],
    fontSize: "",
    lastAvailable: -1,
  };
}

function unwrapTable(parts: TableParts): void {
  const { wrap, table, colgroup } = parts;
  for (const col of parts.cols) col.style.width = "";
  colgroup.remove();
  table.style.tableLayout = "";
  table.style.width = "";
  table.style.fontSize = "";
  wrap.parentElement?.insertBefore(table, wrap);
  wrap.remove();
}

interface Measurement {
  /** 折り返し無しで各カラムが必要とする幅(px) */
  columns: number[];
  /** カラム幅の合計とtableの外寸との差。border-collapse下で数px生じる */
  overhead: number;
}

/**
 * 折り返し無しで各カラムが必要とする幅を、ブラウザ自身に測らせる。
 * 文字数からの推定と違い、日本語・英数字・インラインコードが混ざっていても実寸で取れる。
 */
function measureNaturalWidths(parts: TableParts, fontSize: string): Measurement {
  const { table, cols, headerCells } = parts;
  const previous = {
    tableLayout: table.style.tableLayout,
    width: table.style.width,
    fontSize: table.style.fontSize,
    colWidths: cols.map((col) => col.style.width),
  };
  // colspanを持つコメント行は測定を歪めるため、測っている間だけ隠す
  const commentRows = Array.from(table.querySelectorAll<HTMLElement>(".mdecho-comment-row"));
  const previousRowDisplay = commentRows.map((row) => row.style.display);

  for (const col of cols) col.style.width = "";
  for (const row of commentRows) row.style.display = "none";
  table.style.fontSize = fontSize;
  table.style.tableLayout = "auto";
  table.style.width = "max-content";

  const rawWidths = headerCells.map((cell) => cell.getBoundingClientRect().width);
  const overhead = Math.max(0, Math.ceil(table.getBoundingClientRect().width - sum(rawWidths)));
  // 端数を切り上げるのは、後段でpx整数に丸めたときに1px足りず折り返してしまうのを防ぐため
  const columns = rawWidths.map((width) => Math.ceil(width));

  table.style.tableLayout = previous.tableLayout;
  table.style.width = previous.width;
  table.style.fontSize = previous.fontSize;
  cols.forEach((col, index) => {
    col.style.width = previous.colWidths[index] ?? "";
  });
  commentRows.forEach((row, index) => {
    row.style.display = previousRowDisplay[index] ?? "";
  });

  return { columns, overhead };
}

function computeLayout(parts: TableParts): void {
  const containerWidth = parts.scroll.clientWidth;
  if (containerWidth <= 0) return;

  const base = measureNaturalWidths(parts, "");
  const scale = pickFontScale(sum(base.columns), containerWidth - base.overhead);
  parts.fontSize = scale === 1 ? "" : `${scale}em`;
  // フォントを縮めると自然幅も変わるので、縮めた状態で測り直してから配分する
  const natural = scale === 1 ? base : measureNaturalWidths(parts, parts.fontSize);
  parts.autoWidths = allocateColumnWidths(natural.columns, containerWidth - natural.overhead);
  parts.lastAvailable = containerWidth;
}

function applyWidths(parts: TableParts): void {
  if (parts.autoWidths.length === 0) return;
  // 端数でコンテナをわずかに超えて横スクロールバーが出ないよう切り捨てる
  const widths = parts.autoWidths.map((width, index) =>
    Math.floor(parts.manualWidths[index] ?? width),
  );
  parts.table.style.fontSize = parts.fontSize;
  parts.table.style.tableLayout = "fixed";
  parts.table.style.width = `${sum(widths)}px`;
  widths.forEach((width, index) => {
    const col = parts.cols[index];
    if (col) col.style.width = `${width}px`;
  });
}

function toHandle(parts: TableParts): TableHandle {
  return {
    id: parts.id,
    wrap: parts.wrap,
    scroll: parts.scroll,
    toolsHost: parts.toolsHost,
    headerCells: parts.headerCells,
    relayout: () => {
      computeLayout(parts);
      applyWidths(parts);
    },
    setColumnWidth: (index, width) => {
      // ドラッグ中は測り直さず、確定済みの自動幅に手動幅を上書きするだけにする
      parts.manualWidths[index] = Math.max(Math.round(width), MIN_COLUMN_WIDTH);
      applyWidths(parts);
      writeStoredWidths(parts.id, parts.manualWidths);
    },
    resetColumnWidth: (index) => {
      parts.manualWidths[index] = null;
      applyWidths(parts);
      writeStoredWidths(parts.id, parts.manualWidths);
    },
  };
}

/**
 * markdown-body(生HTML)内の各tableを外枠divで包み、セル内容の実寸からカラム幅を
 * 自動配分する。拡大モーダルや列幅ドラッグのために、React側から触るための
 * ハンドルを返す。
 *
 * htmlは、本文が差し替わったときに包み直すための依存値としてのみ使う。
 */
export function useTableTools(
  markdownBodyRef: RefObject<HTMLElement | null>,
  html: string,
): TableHandle[] {
  const [handles, setHandles] = useState<TableHandle[]>([]);

  useLayoutEffect(() => {
    const root = markdownBodyRef.current;
    if (!root) return;

    const partsList: TableParts[] = [];
    for (const table of root.querySelectorAll("table")) {
      // コメント本文の中のテーブルは対象外(スロットのDOMはReact側が管理する)
      if (table.closest(".mdecho-comment-view-body")) continue;
      const parts = wrapTable(table, String(partsList.length));
      if (parts) partsList.push(parts);
    }
    if (partsList.length === 0) return;

    const byScroll = new Map<Element, TableParts>();
    for (const parts of partsList) {
      computeLayout(parts);
      applyWidths(parts);
      byScroll.set(parts.scroll, parts);
    }

    // ウィンドウリサイズでも拡大モーダルへの出し入れでも、コンテナ幅が変われば計算し直す
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const parts = byScroll.get(entry.target);
        if (!parts) continue;
        if (Math.abs(parts.scroll.clientWidth - parts.lastAvailable) < 1) continue;
        computeLayout(parts);
        applyWidths(parts);
      }
    });
    for (const parts of partsList) observer.observe(parts.scroll);

    setHandles(partsList.map(toHandle));

    return () => {
      observer.disconnect();
      for (const parts of partsList) unwrapTable(parts);
      setHandles([]);
    };
  }, [markdownBodyRef, html]);

  return handles;
}
