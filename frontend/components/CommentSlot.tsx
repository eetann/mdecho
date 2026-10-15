import type { PendingQuote } from "../hooks/useComments.ts";
import { parseKey } from "../lib/comment-keys.ts";
import type { Comment } from "../lib/types.ts";
import { CommentEditor } from "./CommentEditor.tsx";
import { CommentView } from "./CommentView.tsx";

export function CommentSlot({
  commentKey,
  comment,
  isEditing,
  editingInitialText,
  pendingQuote,
  onSave,
  onCancel,
  onDelete,
}: {
  commentKey: string;
  comment: Comment | undefined;
  isEditing: boolean;
  editingInitialText: string;
  pendingQuote: PendingQuote | null;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { startLine, endLine } = parseKey(commentKey);

  if (isEditing) {
    return (
      <CommentEditor
        startLine={startLine}
        endLine={endLine}
        initialText={editingInitialText}
        pendingQuote={pendingQuote}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={comment ? onDelete : undefined}
      />
    );
  }

  if (!comment) return null;

  return <CommentView startLine={startLine} endLine={endLine} text={comment.text} />;
}
