import { FolderOpen, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import type { EntryFile } from "../lib/types.ts";
import { isViewed, loadViewed, saveViewed, toggleViewed } from "../lib/viewed-store.ts";
import { TOOLBAR_FILES_SLOT_ID } from "./Toolbar.tsx";

// 本文の横に一覧を並べる余裕がある幅。目次(TableOfContents)と揃える。
const WIDE_MEDIA_QUERY = "(min-width: 80rem)";

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

  if (entries.length < 2) return null;

  const viewedCount = entries.filter((entry) => isViewed(viewed, entry.relPath, entry.hash)).length;

  const nav = (
    <nav
      ref={navRef}
      className={`mdecho-file-list overflow-y-auto ${
        isWide
          ? `fixed top-24 left-8 z-10 max-h-[calc(100vh-8rem)] w-48 transition-opacity ${
              collapsed ? "pointer-events-none opacity-0" : ""
            }`
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
      {entries.map((entry) => {
        const isCurrent = entry.relPath === relPath;
        const entryViewed = isViewed(viewed, entry.relPath, entry.hash);
        const commentCount = commentCounts.get(entry.relPath) ?? 0;
        // 長いパスは末尾から切れて肝心のファイル名が見えなくなるため、ファイル名とディレクトリを分けて出す
        const slash = entry.filePath.lastIndexOf("/");
        const name = entry.filePath.slice(slash + 1);
        const dir = slash === -1 ? "" : entry.filePath.slice(0, slash + 1);
        return (
          <div
            key={entry.url}
            className={`mdecho-file-list-item flex items-start gap-2 border-l-2 py-0.5 pl-2 text-sm ${
              isCurrent ? "border-primary" : "border-transparent"
            }`}
          >
            <input
              type="checkbox"
              className="checkbox checkbox-xs mt-0.5 shrink-0"
              aria-label={`${entry.filePath} を確認済みにする`}
              title={entryViewed ? "確認済み" : "確認済みにする"}
              checked={entryViewed}
              disabled={entry.hash === ""}
              onChange={() =>
                setViewed((current) => toggleViewed(current, entry.relPath, entry.hash))
              }
            />
            {/* ファイルごとに別のページなので、普通のリンクで移動する。
                コメントはファイルごとに保存しているため、行き来しても消えない。 */}
            <a
              href={entry.url}
              aria-current={isCurrent ? "page" : undefined}
              title={entry.filePath}
              className={`min-w-0 flex-1 transition-colors ${
                isCurrent
                  ? "font-semibold text-base-content"
                  : entryViewed
                    ? "text-base-content/40 hover:text-base-content"
                    : "text-base-content/70 hover:text-base-content"
              }`}
            >
              <span className="block truncate">{name}</span>
              {dir !== "" && (
                <span className="block truncate text-xs font-normal text-base-content/50">
                  {dir}
                </span>
              )}
            </a>
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
      })}
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
      {nav}
    </>
  );
}
