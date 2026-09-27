import mermaid from "mermaid";
import { type RefObject, useEffect } from "react";
import type { ResolvedTheme } from "../../src/styles/theme.ts";

let mermaidRenderIndex = 0;

function getRenderId(): string {
  mermaidRenderIndex += 1;
  return `mdecho-mermaid-${mermaidRenderIndex}`;
}

/**
 * 図のソース。描画すると要素の中身がSVGに置き換わって元のテキストが消えるため、
 * 配色を切り替えて描き直せるよう、最初に見つけたときに属性へ退避しておく。
 */
const SOURCE_ATTRIBUTE = "data-mdecho-mermaid-source";

function readMermaidSource(block: HTMLElement): string {
  const stored = block.getAttribute(SOURCE_ATTRIBUTE);
  if (stored !== null) {
    return stored;
  }
  const source = block.textContent ?? "";
  block.setAttribute(SOURCE_ATTRIBUTE, source);
  return source;
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
 * 本文の中のmermaidブロックを図に描き換える。配色が変わったら描き直す。
 *
 * MarkdownBodyの中でやらずにここへ出しているのは、あのコンポーネントが
 * 「htmlが変わらない限り再レンダーしない」ことを前提にしているため。
 * 配色をpropで渡すと切り替えのたびに再レンダーが走り、Reactが
 * dangerouslySetInnerHTMLを貼り直して本文のDOMごと作り直してしまう
 * (カーソル位置と表示中のコメントが消える)。
 * useTableToolsなどと同じく、markdownBodyRefのDOMを直接触る形にしておく。
 */
export function useMermaid(
  markdownBodyRef: RefObject<HTMLElement | null>,
  html: string,
  theme: ResolvedTheme,
): void {
  useEffect(() => {
    const root = markdownBodyRef.current;
    if (!root) return;

    // 図の中の色はmermaid側のテーマが持っているため、本文の配色と一緒に持ち替える。
    // initializeは何度呼んでもよく、これ以降のrenderに効く。
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
    });

    let cancelled = false;
    // 配色が変わったときは描画済みの図も描き直すため、状態で絞り込まずに全部を対象にする。
    const blocks = Array.from(root.querySelectorAll<HTMLElement>(".mdecho-mermaid"));

    for (const block of blocks) {
      const source = readMermaidSource(block);
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
  }, [markdownBodyRef, html, theme]);
}
