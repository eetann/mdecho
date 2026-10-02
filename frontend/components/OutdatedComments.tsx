import { useState } from "react";
import type { Comment } from "../lib/types.ts";
import { CommentView } from "./CommentView.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";

/**
 * 本文が書き換わって付け先を失ったコメントを、本文の下にまとめて見せる。
 * AIに直してもらった箇所が本当に変わったかを確かめるためのもので、コピーの対象には含めない。
 */
export function OutdatedComments({
  comments,
  clearOutdated,
}: {
  comments: Comment[];
  clearOutdated: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (comments.length === 0) return null;

  return (
    <section className="mdecho-outdated-comments mt-8 border-t border-base-300 pt-4">
      <div className="mb-3 flex items-center gap-4">
        <h2 className="flex-1 text-sm font-bold text-base-content/70">
          Outdated ({comments.length})
          <span className="ml-2 font-normal text-base-content/50">
            コメントした箇所が書き換わったもの(行番号は書き換わる前のもの)
          </span>
        </h2>
        <button
          type="button"
          id="mdecho-clear-outdated-button"
          className="btn btn-sm btn-ghost"
          onClick={() => setConfirming(true)}
        >
          Clear outdated
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {comments.map((comment, index) => (
          <CommentView
            // outdatedは行番号が重なりうるため、並び順で区別する
            key={`${comment.startLine}-${comment.endLine}-${index}`}
            startLine={comment.startLine}
            endLine={comment.endLine}
            text={comment.text}
            originalText={comment.originalText}
            outdated
          />
        ))}
      </div>
      <ConfirmDialog
        open={confirming}
        message={`outdatedになった${comments.length}件のコメントを削除しますか?`}
        onConfirm={() => {
          setConfirming(false);
          clearOutdated();
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
