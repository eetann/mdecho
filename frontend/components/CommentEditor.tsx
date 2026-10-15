import { Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { PendingQuote } from "../hooks/useComments.ts";
import { insertQuote } from "../lib/comment-text.ts";
import { formatLineRef } from "../lib/line-ref.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";

const MIN_TEXTAREA_ROWS = 3;

function autoGrow(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
  const minHeight = lineHeight * MIN_TEXTAREA_ROWS;
  textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`;
}

export function CommentEditor({
  startLine,
  endLine,
  initialText,
  pendingQuote,
  onSave,
  onCancel,
  onDelete,
}: {
  startLine: number;
  endLine: number;
  initialText: string;
  pendingQuote: PendingQuote | null;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    autoGrow(textarea);
    // 初回マウント時のみ実行する(依存配列は意図的に空)
  }, []);

  // 開いた時点で届いていた引用はinitialTextに含まれているので、それより後の引用だけ差し込む
  const appliedQuoteIdRef = useRef(pendingQuote?.id);
  const caretAfterQuoteRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !pendingQuote || appliedQuoteIdRef.current === pendingQuote.id) return;
    appliedQuoteIdRef.current = pendingQuote.id;
    // 本文を選択している間もtextareaはcaret位置を覚えているので、そこへ差し込む
    const next = insertQuote(textarea.value, textarea.selectionStart, pendingQuote.text);
    caretAfterQuoteRef.current = next.caret;
    setText(next.text);
  }, [pendingQuote]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const caret = caretAfterQuoteRef.current;
    if (!textarea || caret === null) return;
    caretAfterQuoteRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    autoGrow(textarea);
  }, [text]);

  return (
    <div className="mdecho-comment-editor card card-border gap-2 bg-base-200 p-2">
      <div className="mdecho-comment-line-ref flex items-center gap-2 font-mono text-xs text-base-content/60 after:flex-1 after:border-t after:border-dashed after:border-base-300 after:content-['']">
        {formatLineRef(startLine, endLine)}
      </div>
      <textarea
        ref={textareaRef}
        className="textarea w-full resize-y border-none bg-transparent text-[17px] leading-[1.4] focus:outline-none"
        rows={MIN_TEXTAREA_ROWS}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          autoGrow(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onSave(text);
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="mdecho-comment-actions flex items-center justify-end gap-2">
        {onDelete && (
          <button
            type="button"
            className="mdecho-comment-delete btn btn-sm btn-ghost mr-auto"
            aria-label="delete comment"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-[1.1em]" />
          </button>
        )}
        <button
          type="button"
          className="mdecho-comment-cancel btn btn-sm btn-ghost"
          onClick={onCancel}
        >
          cancel
        </button>
        <button
          type="button"
          className="mdecho-comment-save btn btn-sm btn-primary"
          onClick={() => onSave(text)}
        >
          save
        </button>
      </div>
      {onDelete && (
        <ConfirmDialog
          open={confirmingDelete}
          message="このコメントを削除しますか?"
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
