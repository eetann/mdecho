import { useLayoutEffect, useRef, useState } from "react";
import { parseKey } from "../lib/comment-keys.ts";

function findSlotRoot(key: string): Element | null {
  return document.querySelector(`[data-mdecho-comment-slot="${key}"]`);
}

function getContentHost(slotRoot: Element): Element {
  return slotRoot.tagName === "TR" ? (slotRoot.querySelector("td") ?? slotRoot) : slotRoot;
}

/**
 * 同一startLine-endLineクラスタ内で、自分よりsentenceIndexが小さい既存スロットを
 * 辿り、挿入直後に置くべき参照要素を返す。挿入順(文の出現順)が反転しないようにするため。
 */
function findInsertionReference(
  anchor: Element,
  startLine: number,
  endLine: number,
  sentenceIndex: number,
): Element {
  let ref = anchor;
  let sibling = anchor.nextElementSibling;
  while (sibling) {
    const siblingKey = sibling.getAttribute("data-mdecho-comment-slot");
    if (!siblingKey) break;
    const parsed = parseKey(siblingKey);
    if (parsed.startLine !== startLine || parsed.endLine !== endLine) break;
    if (parsed.sentenceIndex >= sentenceIndex) break;
    ref = sibling;
    sibling = sibling.nextElementSibling;
  }
  return ref;
}

function createSlotRoot(target: Element, key: string): Element {
  const { startLine, endLine, sentenceIndex } = parseKey(key);
  const ref = findInsertionReference(target, startLine, endLine, sentenceIndex);

  if (target.tagName === "TR") {
    const row = document.createElement("tr");
    row.className = "mdecho-comment-row";
    row.setAttribute("data-mdecho-comment-slot", key);
    const td = document.createElement("td");
    td.colSpan = target.children.length || 1;
    row.appendChild(td);
    ref.insertAdjacentElement("afterend", row);
    return row;
  }
  const div = document.createElement("div");
  div.className = "mdecho-comment-slot";
  div.setAttribute("data-mdecho-comment-slot", key);
  ref.insertAdjacentElement("afterend", div);
  return div;
}

/**
 * markdown-body(生HTML)内の対象行の直後にコメントスロットのDOMを命令的に生成/破棄し、
 * portalで中身をマウントするためのcontentHostを key ごとに返す。
 * targetsは、cursor targetsが揃うより前に visibleKeys が変化した場合に
 * 再実行させるための依存値としてのみ使う。
 */
export function useCommentSlots(
  visibleKeys: string[],
  getTargetByLineAndSentence: (line: number, sentenceIndex: number) => Element | null,
  targets: readonly Element[],
): Map<string, Element> {
  const [contentHosts, setContentHosts] = useState<Map<string, Element>>(new Map());
  const rootsRef = useRef<Map<string, Element>>(new Map());

  useLayoutEffect(() => {
    const roots = rootsRef.current;
    const keySet = new Set(visibleKeys);

    for (const [key, root] of roots) {
      if (!keySet.has(key)) {
        root.remove();
        roots.delete(key);
      }
    }

    for (const key of visibleKeys) {
      if (roots.has(key)) continue;
      const { endLine, sentenceIndex } = parseKey(key);
      const target = getTargetByLineAndSentence(endLine, sentenceIndex);
      if (!target) continue;
      const root = findSlotRoot(key) ?? createSlotRoot(target, key);
      roots.set(key, root);
    }

    setContentHosts(() => {
      const next = new Map<string, Element>();
      for (const [key, root] of roots) {
        next.set(key, getContentHost(root));
      }
      return next;
    });
  }, [visibleKeys, getTargetByLineAndSentence, targets]);

  return contentHosts;
}
