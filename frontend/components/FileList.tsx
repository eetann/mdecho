import { ChevronDown, ChevronRight, FolderOpen, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { formatChangeBadge } from "../lib/change-label.ts";
import {
  clampFileListWidth,
  DEFAULT_FILE_LIST_WIDTH,
  loadFileListWidth,
  MIN_FILE_LIST_WIDTH,
  saveFileListWidth,
} from "../lib/file-list-width.ts";
import {
  buildFileTree,
  collectFiles,
  type FileTreeDir,
  type FileTreeFile,
  type FileTreeNode,
} from "../lib/file-tree.ts";
import type { EntryFile } from "../lib/types.ts";
import { isViewed, loadViewed, saveViewed, toggleViewed } from "../lib/viewed-store.ts";
import { TOOLBAR_FILES_SLOT_ID } from "./Toolbar.tsx";

// 本文の横に一覧を並べる余裕がある幅。目次(TableOfContents)と揃える。
const WIDE_MEDIA_QUERY = "(min-width: 80rem)";

/** ツリーの1階層ぶんの字下げ。境界線(border-l-2)の内側に0.5remの余白を残す */
function indent(depth: number): string {
  return `calc(${depth} * 0.875rem + 0.5rem)`;
}

/**
 * 指定された複数のファイルを切り替える一覧。ファイルが1つのときは出さない。
 * 広い画面では左に常に出しておき、狭い画面ではツールバーのボタンから本文に重ねて開く。
 * 開閉の振る舞いは目次と揃えている。
 *
 * 各ファイルに「見た」チェックとコメント数を添えて、どこまで読んだかを追えるようにする。
 * チェックはファイルの内容が変わると外れる(AIが直したファイルだけ読み直せばよいように)。
 */
export function FileList({
  entries,
  relPath,
  commentCounts,
}: {
  entries: EntryFile[];
  relPath: string;
  /** ファイルごとのコメント数(relPathで引く) */
  commentCounts: ReadonlyMap<string, number>;
}) {
  const isWide = useMediaQuery(WIDE_MEDIA_QUERY);
  const [collapsed, setCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const isOverlay = !isWide && overlayOpen;
  const navRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const [viewed, setViewed] = useState(loadViewed);
  const tree = useMemo(() => buildFileTree(entries), [entries]);
  // 既定ではすべて開いておき、閉じたディレクトリだけを覚える
  const [closedDirs, setClosedDirs] = useState<ReadonlySet<string>>(() => new Set());
  const [width, setWidth] = useState(() =>
    clampFileListWidth(loadFileListWidth(), window.innerWidth),
  );
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  useEffect(() => saveViewed(viewed), [viewed]);
  // ツールバーは一覧より先に描画されるので、ここで探せば置き場所はもうある
  const [toolbarSlot, setToolbarSlot] = useState<Element | null>(null);
  useLayoutEffect(() => {
    setToolbarSlot(document.getElementById(TOOLBAR_FILES_SLOT_ID));
  }, []);

  // 重ねて開いた一覧は、Escか一覧の外を押したら閉じる
  useEffect(() => {
    if (!isOverlay) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOverlayOpen(false);
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (navRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOverlayOpen(false);
    }
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOverlay]);

  // 一覧の幅をレイアウト側(本文の左の余白)と共有する
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--mdecho-file-list-width", `${width}px`);
  }, [width]);
  useEffect(() => {
    if (!dragging) saveFileListWidth(width);
  }, [width, dragging]);
  // ドラッグ中はポインタが境界から外れてもカーソルを保ち、本文の文字が選択されないようにする
  useEffect(() => {
    if (!dragging) return;
    const { style } = document.body;
    const previous = { cursor: style.cursor, userSelect: style.userSelect };
    style.cursor = "col-resize";
    style.userSelect = "none";
    return () => {
      style.cursor = previous.cursor;
      style.userSelect = previous.userSelect;
    };
  }, [dragging]);

  if (entries.length < 2) return null;

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
  }
  function handleResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setWidth(clampFileListWidth(drag.startWidth + event.clientX - drag.startX, window.innerWidth));
  }
  function handleResizeEnd() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
  }
  function handleResizeKeydown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 64 : 16;
    let next: number;
    if (event.key === "ArrowLeft") next = width - step;
    else if (event.key === "ArrowRight") next = width + step;
    else if (event.key === "Home") next = DEFAULT_FILE_LIST_WIDTH;
    else return;
    event.preventDefault();
    setWidth(clampFileListWidth(next, window.innerWidth));
  }

  const viewedCount = entries.filter((entry) => isViewed(viewed, entry.relPath, entry.hash)).length;

  function renderFile(file: FileTreeFile, depth: number) {
    const { entry } = file;
    const isCurrent = entry.relPath === relPath;
    const entryViewed = isViewed(viewed, entry.relPath, entry.hash);
    const commentCount = commentCounts.get(entry.relPath) ?? 0;
    const { change } = entry;
    const changeBadge = change && formatChangeBadge(change);
    return (
      <div
        key={entry.url}
        className={`mdecho-file-list-item flex items-start gap-2 border-l-2 py-0.5 pr-1 text-sm ${
          isCurrent ? "border-primary" : "border-transparent"
        }`}
        style={{ paddingLeft: indent(depth) }}
      >
        <input
          type="checkbox"
          className="checkbox checkbox-xs mt-0.5 shrink-0"
          aria-label={`${entry.filePath} を確認済みにする`}
          title={entryViewed ? "確認済み" : "確認済みにする"}
          checked={entryViewed}
          disabled={entry.hash === ""}
          onChange={() => setViewed((current) => toggleViewed(current, entry.relPath, entry.hash))}
        />
        {/* ファイルごとに別のページなので、普通のリンクで移動する。
            コメントはファイルごとに保存しているため、行き来しても消えない。 */}
        <a
          href={entry.url}
          aria-current={isCurrent ? "page" : undefined}
          title={entry.filePath}
          className={`min-w-0 flex-1 truncate transition-colors ${
            isCurrent
              ? "font-semibold text-base-content"
              : entryViewed
                ? "text-base-content/40 hover:text-base-content"
                : "text-base-content/70 hover:text-base-content"
          }`}
        >
          {file.name}
        </a>
        {change && changeBadge && (
          <span
            className={`mdecho-file-list-change badge badge-sm badge-soft mt-0.5 shrink-0 tabular-nums ${
              change.status === "added" ? "badge-success" : "badge-warning"
            }`}
            title={
              change.status === "added"
                ? `新規ファイル(${change.added}行)`
                : `${change.added}行追加、${change.deleted}行削除`
            }
          >
            {changeBadge}
          </span>
        )}
        {commentCount > 0 && (
          <span
            className="mdecho-file-list-comment-count badge badge-sm badge-primary badge-soft mt-0.5 shrink-0"
            title={`コメント${commentCount}件`}
          >
            {commentCount}
          </span>
        )}
      </div>
    );
  }

  function renderDir(dir: FileTreeDir, depth: number) {
    const isOpen = !closedDirs.has(dir.key);
    const files = collectFiles(dir.children);
    const allViewed = files.every((entry) => isViewed(viewed, entry.relPath, entry.hash));
    const Chevron = isOpen ? ChevronDown : ChevronRight;
    return (
      <div key={`dir:${dir.key}`} className="mdecho-file-list-dir">
        <button
          type="button"
          className={`flex w-full items-center gap-1 border-l-2 border-transparent py-0.5 pr-1 text-left text-sm transition-colors hover:text-base-content ${
            allViewed ? "text-base-content/40" : "text-base-content/60"
          }`}
          style={{ paddingLeft: indent(depth) }}
          aria-expanded={isOpen}
          title={dir.key}
          onClick={() =>
            setClosedDirs((current) => {
              const next = new Set(current);
              if (isOpen) next.add(dir.key);
              else next.delete(dir.key);
              return next;
            })
          }
        >
          <Chevron className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{dir.name}</span>
          {!isOpen && (
            <span className="shrink-0 text-xs tabular-nums text-base-content/50">
              {files.filter((entry) => isViewed(viewed, entry.relPath, entry.hash)).length}/
              {files.length}
            </span>
          )}
        </button>
        {isOpen && <div role="group">{renderNodes(dir.children, depth + 1)}</div>}
      </div>
    );
  }

  function renderNodes(nodes: readonly FileTreeNode[], depth: number) {
    return nodes.map((node) =>
      node.kind === "dir" ? renderDir(node, depth) : renderFile(node, depth),
    );
  }

  const nav = (
    <nav
      ref={navRef}
      className={`mdecho-file-list overflow-y-auto ${
        isWide
          ? "max-h-[calc(100vh-8rem)]"
          : // ツールバーの一覧ボタンの真下に、本文に重ねて開く
            `absolute top-full left-0 mt-2 max-h-[70vh] w-72 max-w-[calc(100vw-4rem)] rounded-box border border-base-300 bg-base-100 p-3 shadow-lg ${
              overlayOpen ? "" : "hidden"
            }`
      }`}
      aria-label="ファイル一覧"
    >
      <p className="mdecho-file-list-progress mb-1 pl-2 text-xs text-base-content/60">
        確認済み {viewedCount} / {entries.length}
      </p>
      {renderNodes(tree, 0)}
    </nav>
  );

  if (!isWide) {
    if (!toolbarSlot) return null;
    // 狭い画面では左側に並べる場所が無いので、ボタンごとツールバーの中へ置く。
    return createPortal(
      <>
        <button
          ref={toggleRef}
          type="button"
          className="mdecho-file-list-toggle btn btn-sm btn-ghost"
          aria-label={overlayOpen ? "ファイル一覧を閉じる" : "ファイル一覧を開く"}
          aria-expanded={overlayOpen}
          title="ファイル一覧"
          onClick={() => setOverlayOpen((current) => !current)}
        >
          {overlayOpen ? <X className="size-[1.1em]" /> : <FolderOpen className="size-[1.1em]" />}
        </button>
        {nav}
      </>,
      toolbarSlot,
    );
  }

  return (
    <>
      <button
        type="button"
        className="mdecho-file-list-toggle btn btn-xs btn-circle fixed top-16 left-8 z-30"
        aria-label={collapsed ? "ファイル一覧を表示" : "ファイル一覧を折りたたむ"}
        onClick={() => setCollapsed((current) => !current)}
      >
        {collapsed ? <FolderOpen className="size-[1.1em]" /> : "×"}
      </button>
      {/* 幅は--mdecho-file-list-widthで本文の左の余白と共有する(styles.css) */}
      <div
        className={`mdecho-file-list-panel fixed top-24 left-8 z-10 w-(--mdecho-file-list-width) transition-opacity ${
          collapsed ? "pointer-events-none opacity-0" : ""
        }`}
      >
        {nav}
        {/* 右の境界をドラッグして幅を変える。ダブルクリックで既定の幅に戻す */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="ファイル一覧の幅"
          aria-valuenow={width}
          aria-valuemin={MIN_FILE_LIST_WIDTH}
          tabIndex={collapsed ? -1 : 0}
          title="ドラッグで幅を変更(ダブルクリックで元に戻す)"
          className="mdecho-file-list-resizer group absolute inset-y-0 -right-3 flex w-3 cursor-col-resize touch-none justify-center outline-none"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          onDoubleClick={() =>
            setWidth(clampFileListWidth(DEFAULT_FILE_LIST_WIDTH, window.innerWidth))
          }
          onKeyDown={handleResizeKeydown}
        >
          <div
            className={`h-full w-0.5 rounded-full transition-colors ${
              dragging
                ? "bg-primary"
                : "bg-transparent group-hover:bg-base-300 group-focus-visible:bg-primary"
            }`}
          />
        </div>
      </div>
    </>
  );
}
