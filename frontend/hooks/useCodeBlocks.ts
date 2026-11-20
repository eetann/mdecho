import { type RefObject, useLayoutEffect, useState } from "react";

export interface CodeBlockHandle {
  id: string;
  /** コピーボタンをportalでマウントするための空div */
  toolsHost: HTMLElement;
  /** コードブロックの中身を、Markdownに書かれたとおりのテキストで返す */
  getText: () => string;
}

interface CodeBlockParts {
  wrap: HTMLElement;
  pre: HTMLElement;
}

/**
 * コードの各行(Shikiの`.line`)だけを拾って改行でつなぐ。
 * preの中には行の直後にコメントスロットが差し込まれるため、pre.textContentを
 * そのまま使うとコメントの文面まで混ざってしまう。コメント本文に含まれるコードの`.line`も
 * 拾わないよう、code直下の子だけを見る。
 */
function readCodeText(pre: HTMLElement): string {
  const code = pre.querySelector(":scope > code");
  if (!code) return pre.textContent ?? "";
  return Array.from(code.children)
    .filter((child) => child.classList.contains("line"))
    .map((line) => line.textContent ?? "")
    .join("\n");
}

function wrapCodeBlock(pre: HTMLElement): CodeBlockParts & { toolsHost: HTMLElement } {
  const wrap = document.createElement("div");
  wrap.className = "mdecho-code-wrap";
  const toolsHost = document.createElement("div");
  toolsHost.className = "mdecho-code-tools";
  pre.parentElement?.insertBefore(wrap, pre);
  wrap.append(pre, toolsHost);
  return { wrap, pre, toolsHost };
}

function unwrapCodeBlock({ wrap, pre }: CodeBlockParts): void {
  wrap.parentElement?.insertBefore(pre, wrap);
  wrap.remove();
}

/**
 * markdown-body(生HTML)内の各コードブロックを外枠divで包み、
 * React側からコピーボタンを載せるためのハンドルを返す。
 * preは横スクロールするため、ボタンをpreの中に置くとスクロールと一緒に流れてしまう。
 * 外枠に置けばスクロール位置に関係なく右上に留まる。
 *
 * htmlは、本文が差し替わったときに包み直すための依存値としてのみ使う。
 */
export function useCodeBlocks(
  markdownBodyRef: RefObject<HTMLElement | null>,
  html: string,
): CodeBlockHandle[] {
  const [handles, setHandles] = useState<CodeBlockHandle[]>([]);

  useLayoutEffect(() => {
    const root = markdownBodyRef.current;
    if (!root) return;

    const partsList: CodeBlockParts[] = [];
    const nextHandles: CodeBlockHandle[] = [];
    for (const pre of root.querySelectorAll<HTMLElement>("pre.shiki")) {
      // コメント本文の中のコードブロックは対象外(スロットのDOMはReact側が管理する)
      if (pre.closest(".mdecho-comment-view-body")) continue;
      const { toolsHost, ...parts } = wrapCodeBlock(pre);
      partsList.push(parts);
      nextHandles.push({
        id: String(nextHandles.length),
        toolsHost,
        getText: () => readCodeText(pre),
      });
    }
    if (partsList.length === 0) return;

    setHandles(nextHandles);

    return () => {
      for (const parts of partsList) unwrapCodeBlock(parts);
      setHandles([]);
    };
  }, [markdownBodyRef, html]);

  return handles;
}
