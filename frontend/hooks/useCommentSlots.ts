import { useLayoutEffect, useRef, useState } from "react";
import { parseKey } from "../lib/comment-keys.ts";

function findSlotRoot(key: string): Element | null {
  return document.querySelector(`[data-mdecho-comment-slot="${key}"]`);
}

function getContentHost(slotRoot: Element): Element {
  return slotRoot.tagName === "TR" ? (slotRoot.querySelector("td") ?? slotRoot) : slotRoot;
}

function createSlotRoot(target: Element, key: string): Element {
  if (target.tagName === "TR") {
    const row = document.createElement("tr");
    row.className = "mdecho-comment-row";
    row.setAttribute("data-mdecho-comment-slot", key);
    const td = document.createElement("td");
    td.colSpan = target.children.length || 1;
    row.appendChild(td);
    target.insertAdjacentElement("afterend", row);
    return row;
  }
  const div = document.createElement("div");
  div.className = "mdecho-comment-slot";
  div.setAttribute("data-mdecho-comment-slot", key);
  target.insertAdjacentElement("afterend", div);
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
  getTargetByLine: (line: number) => Element | null,
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
      const { endLine } = parseKey(key);
      const target = getTargetByLine(endLine);
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
  }, [visibleKeys, getTargetByLine, targets]);

  return contentHosts;
}
