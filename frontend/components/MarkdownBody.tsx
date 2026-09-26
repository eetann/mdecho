import { forwardRef, memo, useImperativeHandle, useRef } from "react";

/**
 * dangerouslySetInnerHTMLで挿入したDOM(cursor/コメント/表/mermaidが要素参照を保持したり
 * 属性を書き込んだりする)が、親の無関係な再レンダー(コメント編集の開始など)のたびに
 * 作り直されないよう、htmlが変わらない限り再レンダーしないようmemo化する。
 *
 * このため **htmlの他にpropを増やしてはいけない**。増やすとその値が変わるたびに
 * 再レンダーが走り、Reactがinnerhtmlを貼り直して本文のDOMがまるごと入れ替わる
 * (カーソル位置と表示中のコメントが消える)。
 * 本文のDOMに対して何かしたいときは、markdownBodyRefを受け取るhookとして書くこと
 * (useMermaid / useTableTools / useCommentSlots がその形)。
 */
export const MarkdownBody = memo(
  forwardRef<HTMLElement, { html: string }>(function MarkdownBody({ html }, ref) {
    const innerRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLElement, []);

    return (
      <article
        className="markdown-body min-w-0 flex-1"
        ref={innerRef}
        // biome-ignore lint: サーバー側の自前Markdownパイプライン(unified/remark/rehype)が生成したHTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }),
);
