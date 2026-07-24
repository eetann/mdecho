import { parseKey } from "../lib/comment-keys.ts";
import type { Comment } from "../lib/types.ts";
import { CommentEditor } from "./CommentEditor.tsx";
import { CommentView } from "./CommentView.tsx";

export function CommentSlot({
  commentKey,
  comment,
  isEditing,
  editingInitialText,
  onSave,
  onCancel,
  onDelete,
}: {
  commentKey: string;
  comment: Comment | undefined;
  isEditing: boolean;
  editingInitialText: string;
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
        onSave={onSave}
        onCancel={onCancel}
        onDelete={comment ? onDelete : undefined}
      />
    );
  }

  if (!comment) return null;

  return <CommentView startLine={startLine} endLine={endLine} text={comment.text} />;
}
