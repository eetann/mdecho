import { House, Keyboard, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { buildClipboardText } from "../lib/clipboard-text.ts";
import type { Comment } from "../lib/types.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { KeyboardHelpDialog } from "./KeyboardHelpDialog.tsx";

const COPIED_LABEL_DURATION_MS = 1500;

type CopyLabel = "Copy" | "Copied!" | "Copy failed";

export function Toolbar({
  relPath,
  filePath,
  entryRelPath,
  comments,
  deleteAllComments,
  openSettings,
}: {
  /** Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス */
  relPath: string;
  /** `-f`に渡したパスと同じ書き方で表した、表示中ファイルのパス(クリップボードに載る) */
  filePath: string;
  /** 同じ形式で表した`-f`のファイルのパス */
  entryRelPath: string;
  comments: Map<string, Comment>;
  deleteAllComments: () => void;
  openSettings: () => void;
}) {
  const [label, setLabel] = useState<CopyLabel>("Copy");
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const isEntry = relPath === entryRelPath;

  async function handleCopyClick() {
    if (comments.size === 0) return;
    const text = buildClipboardText(filePath, comments.values());
    try {
      await navigator.clipboard.writeText(text);
      setLabel("Copied!");
    } catch {
      setLabel("Copy failed");
    }
    setTimeout(() => setLabel("Copy"), COPIED_LABEL_DURATION_MS);
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
        disabled={comments.size === 0}
        onClick={handleCopyClick}
      >
        {label}
      </button>
      <button
        type="button"
        id="mdecho-delete-all-button"
        className="btn btn-sm btn-ghost"
        aria-label="delete all comments"
        disabled={comments.size === 0}
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
        message="すべてのコメントを削除しますか?"
        onConfirm={() => {
          setConfirmingDeleteAll(false);
          deleteAllComments();
        }}
        onCancel={() => setConfirmingDeleteAll(false)}
      />
    </div>
  );
}
