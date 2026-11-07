import type { PendingQuote } from "../hooks/useComments.ts";
import { parseKey } from "../lib/comment-keys.ts";
import type { Comment } from "../lib/types.ts";
import { CommentEditor } from "./CommentEditor.tsx";
import { CommentView } from "./CommentView.tsx";

export function CommentSlot({
  commentKey,
  comment,
  editingInitialText,
  pendingQuote,
  onSave,
  onCancel,
  onDelete,
  onFocus,
}: {
  commentKey: string;
  comment: Comment | undefined;
  /** 編集中ならエディタを開いたときの初期テキスト。編集していなければundefined */
  editingInitialText: string | undefined;
  pendingQuote: PendingQuote | null;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDelete: () => void;
  onFocus: () => void;
}) {
  const { startLine, endLine } = parseKey(commentKey);

  if (editingInitialText !== undefined) {
    return (
      <CommentEditor
        startLine={startLine}
        endLine={endLine}
        initialText={editingInitialText}
        // 他のエディタ宛ての引用は渡さない
        pendingQuote={pendingQuote?.key === commentKey ? pendingQuote : null}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={comment ? onDelete : undefined}
        onFocus={onFocus}
      />
    );
  }

  if (!comment) return null;

  return <CommentView startLine={startLine} endLine={endLine} text={comment.text} />;
}
