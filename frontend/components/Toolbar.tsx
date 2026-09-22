import { House, Keyboard, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { buildClipboardText, type CommentGroup } from "../lib/clipboard-text.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { KeyboardHelpDialog } from "./KeyboardHelpDialog.tsx";

const COPIED_LABEL_DURATION_MS = 1500;

type CopyState = "idle" | "copied" | "failed";

export function Toolbar({
  relPath,
  filePath,
  entryRelPath,
  commentGroups,
  otherFileCount,
  deleteAllComments,
  openSettings,
}: {
  /** Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス */
  relPath: string;
  /** `-f`に渡したパスと同じ書き方で表した、表示中ファイルのパス(クリップボードに載る) */
  filePath: string;
  /** 同じ形式で表した`-f`のファイルのパス */
  entryRelPath: string;
  /** 表示中のファイルと、リンク先で書いたコメントを合わせたコピー対象 */
  commentGroups: CommentGroup[];
  /** 表示中のファイル以外に残っているコメントの数 */
  otherFileCount: number;
  deleteAllComments: () => void;
  openSettings: () => void;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const isEntry = relPath === entryRelPath;

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
      {/* ドキュメント内のリンクを辿った先から、`-f`で開いたファイルへ一度で戻れるようにする */}
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
