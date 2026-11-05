import { House, Keyboard, Monitor, Moon, Settings, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ThemeMode } from "../../src/styles/theme.ts";
import { buildClipboardText, type CommentGroup } from "../lib/clipboard-text.ts";
import type { EntryFile } from "../lib/types.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { KeyboardHelpDialog } from "./KeyboardHelpDialog.tsx";

const COPIED_LABEL_DURATION_MS = 1500;

type CopyState = "idle" | "copied" | "failed";

/** 狭い画面で、目次(TableOfContents)が自分の開閉ボタンを差し込む置き場所 */
export const TOOLBAR_SLOT_ID = "mdecho-toolbar-toc-slot";

/** 狭い画面で、ファイル一覧(FileList)が自分の開閉ボタンを差し込む置き場所 */
export const TOOLBAR_FILES_SLOT_ID = "mdecho-toolbar-files-slot";

/** ボタンを押すたびにこの順で巡回する。設定モーダルの「配色」も同じ並び。 */
export const THEME_MODE_ORDER: ThemeMode[] = ["system", "light", "dark"];

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: "OSに合わせる",
  light: "ライト",
  dark: "ダーク",
};

const THEME_MODE_ICONS: Record<ThemeMode, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const index = THEME_MODE_ORDER.indexOf(mode);
  return THEME_MODE_ORDER[(index + 1) % THEME_MODE_ORDER.length] ?? "system";
}

export function Toolbar({
  relPath,
  filePath,
  entries,
  commentGroups,
  otherFileCount,
  deleteAllComments,
  openSettings,
  themeMode,
  setThemeMode,
}: {
  /** Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス */
  relPath: string;
  /** `-f`に渡したパスと同じ書き方で表した、表示中ファイルのパス(クリップボードに載る) */
  filePath: string;
  /** 指定されたファイルの一覧。先頭がURLの`/`で開くファイル */
  entries: EntryFile[];
  /** 表示中のファイルと、リンク先で書いたコメントを合わせたコピー対象 */
  commentGroups: CommentGroup[];
  /** 表示中のファイル以外に残っているコメントの数 */
  otherFileCount: number;
  deleteAllComments: () => void;
  openSettings: () => void;
  /** いま選ばれている配色の指定(system/light/dark) */
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [entry] = entries;
  const entryRelPath = entry?.relPath ?? "";
  const isEntry = relPath === entryRelPath;
  const ThemeIcon = THEME_MODE_ICONS[themeMode];

  const totalCount = commentGroups.reduce(
    (total, group) => total + Array.from(group.comments).length,
    0,
  );
  const copyLabel =
    copyState === "copied"
      ? "Copied!"
      : copyState === "failed"
        ? "Copy failed"
        : totalCount === 0
          ? "Copy"
          : `Copy (${totalCount})`;
  // 画面に見えている数と違うことがあるため、内訳を添えておく。
  const otherFilesNote =
    otherFileCount === 0 ? undefined : `他のファイルの${otherFileCount}件を含む`;

  async function handleCopyClick() {
    if (totalCount === 0) return;
    try {
      await navigator.clipboard.writeText(buildClipboardText(commentGroups));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), COPIED_LABEL_DURATION_MS);
  }

  return (
    <div className="mdecho-toolbar navbar sticky top-0 z-20 gap-4 bg-base-100 px-0 py-3">
      {entries.length < 2 ? (
        // ドキュメント内のリンクを辿った先から、`-f`で開いたファイルへ一度で戻れるようにする
        <a
          href="/"
          id="mdecho-home-link"
          className={`btn btn-sm btn-ghost ${isEntry ? "btn-disabled" : ""}`}
          aria-label="entry file"
          aria-disabled={isEntry}
          tabIndex={isEntry ? -1 : undefined}
          title={isEntry ? entryRelPath : `${entryRelPath} に戻る`}
        >
          <House className="size-[1.1em]" />
        </a>
      ) : (
        // 複数のファイルを指定したときは、戻る先もファイル一覧から選ぶ
        <div id={TOOLBAR_FILES_SLOT_ID} className="relative empty:hidden" />
      )}
      <span
        className="mdecho-file-path min-w-0 flex-1 truncate text-sm text-base-content/60"
        title={filePath}
      >
        {relPath}
      </span>
      <button
        type="button"
        id="mdecho-copy-button"
        className="btn btn-sm"
        disabled={totalCount === 0}
        title={otherFilesNote}
        onClick={handleCopyClick}
      >
        {copyLabel}
      </button>
      <button
        type="button"
        id="mdecho-delete-all-button"
        className="btn btn-sm btn-ghost"
        aria-label="delete all comments"
        disabled={totalCount === 0}
        title={otherFilesNote}
        onClick={() => setConfirmingDeleteAll(true)}
      >
        <Trash2 className="size-[1.1em]" />
      </button>
      {/* 1クリックで切り替えたいので、3つの状態を巡回するボタンにする。
          いま何が選ばれているかはアイコンで、次に何になるかはtitleで伝える。 */}
      <button
        type="button"
        id="mdecho-theme-button"
        className="btn btn-sm btn-ghost"
        aria-label={`color theme: ${themeMode}`}
        title={`配色: ${THEME_MODE_LABELS[themeMode]}(押すと${THEME_MODE_LABELS[nextThemeMode(themeMode)]}へ)`}
        onClick={() => setThemeMode(nextThemeMode(themeMode))}
      >
        <ThemeIcon className="size-[1.1em]" />
      </button>
      <button
        type="button"
        id="mdecho-keyboard-help-button"
        className="btn btn-sm btn-ghost"
        aria-label="keyboard shortcuts"
        title="キーボード操作"
        onClick={() => setKeyboardHelpOpen(true)}
      >
        <Keyboard className="size-[1.1em]" />
      </button>
      <button
        type="button"
        id="mdecho-settings-button"
        className="btn btn-sm btn-ghost"
        aria-label="settings"
        onClick={openSettings}
      >
        <Settings className="size-[1.1em]" />
      </button>
      {/* 空のあいだは隠して、ボタン間のgapが余計に空かないようにする */}
      <div id={TOOLBAR_SLOT_ID} className="relative empty:hidden" />
      <KeyboardHelpDialog open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />
      <ConfirmDialog
        open={confirmingDeleteAll}
        message={
          otherFileCount === 0
            ? "すべてのコメントを削除しますか?"
            : `他のファイルの${otherFileCount}件を含む、${totalCount}件のコメントを削除しますか?`
        }
        onConfirm={() => {
          setConfirmingDeleteAll(false);
          deleteAllComments();
        }}
        onCancel={() => setConfirmingDeleteAll(false)}
      />
    </div>
  );
}
