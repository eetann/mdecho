import mermaid from "mermaid";
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from "react";

let mermaidRenderIndex = 0;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "default",
});

function getRenderId(): string {
  mermaidRenderIndex += 1;
  return `mdecho-mermaid-${mermaidRenderIndex}`;
}

function renderMermaidError(block: HTMLElement, source: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const label = document.createElement("div");
  label.className = "mdecho-mermaid-error";
  label.textContent = `Mermaid render failed: ${message}`;

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = source;
  pre.append(code);

  block.replaceChildren(label, pre);
  block.setAttribute("data-mdecho-mermaid-rendered", "error");
}

/**
 * dangerouslySetInnerHTMLで挿入したDOM(cursor/コメント機能が要素参照を保持する)が
 * 親の無関係な再レンダー(コメント編集の開始など)のたびに作り直されないよう、
 * htmlが変わらない限り再レンダーしないようmemo化する。
 */
export const MarkdownBody = memo(
  forwardRef<HTMLElement, { html: string }>(function MarkdownBody({ html }, ref) {
    const innerRef = useRef<HTMLElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLElement, []);

    useEffect(() => {
      const root = innerRef.current;
      if (!root) return;

      let cancelled = false;
      const blocks = Array.from(
        root.querySelectorAll<HTMLElement>(".mdecho-mermaid:not([data-mdecho-mermaid-rendered])"),
      );

      for (const block of blocks) {
        const source = block.textContent ?? "";
        block.setAttribute("data-mdecho-mermaid-rendered", "pending");
        void mermaid
          .render(getRenderId(), source)
          .then(({ svg, bindFunctions }) => {
            if (cancelled) return;
            block.innerHTML = svg;
            bindFunctions?.(block);
            block.setAttribute("data-mdecho-mermaid-rendered", "done");
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            renderMermaidError(block, source, error);
          });
      }

      return () => {
        cancelled = true;
      };
    }, [html]);

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
