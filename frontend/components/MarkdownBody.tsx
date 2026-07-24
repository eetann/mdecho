import { forwardRef, memo } from "react";

/**
 * dangerouslySetInnerHTMLで挿入したDOM(cursor/コメント機能が要素参照を保持する)が
 * 親の無関係な再レンダー(コメント編集の開始など)のたびに作り直されないよう、
 * htmlが変わらない限り再レンダーしないようmemo化する。
 */
export const MarkdownBody = memo(
  forwardRef<HTMLElement, { html: string }>(function MarkdownBody({ html }, ref) {
    return (
      <article
        className="markdown-body min-w-0 flex-1"
        ref={ref}
        // biome-ignore lint: サーバー側の自前Markdownパイプライン(unified/remark/rehype)が生成したHTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }),
);
