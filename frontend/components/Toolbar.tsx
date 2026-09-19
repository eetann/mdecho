import { Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { buildClipboardText } from "../lib/clipboard-text.ts";
import type { Comment } from "../lib/types.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";

const COPIED_LABEL_DURATION_MS = 1500;

type CopyLabel = "Copy" | "Copied!" | "Copy failed";

export function Toolbar({
  fileName,
  filePath,
  comments,
  deleteAllComments,
  openSettings,
}: {
  fileName: string;
  filePath: string;
  comments: Map<string, Comment>;
  deleteAllComments: () => void;
  openSettings: () => void;
}) {
  const [label, setLabel] = useState<CopyLabel>("Copy");
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);

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
      <span className="mdecho-file-name min-w-0 flex-1 truncate text-sm text-base-content/60">
        {fileName}
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
        id="mdecho-settings-button"
        className="btn btn-sm btn-ghost"
        aria-label="settings"
        onClick={openSettings}
      >
        <Settings className="size-[1.1em]" />
      </button>
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
