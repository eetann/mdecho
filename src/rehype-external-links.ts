import type { Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const EXTERNAL_HREF_PATTERN = /^https?:\/\//i;

/**
 * http(s)の外部リンクだけを新しいタブで開くようにする。
 * `./foo.md`のようなドキュメントへの相対リンクや`#見出し`のページ内リンクは、
 * どう扱うかが未定のため対象外(既定の遷移のまま)。
 */
export const rehypeExternalLinks: Plugin<[], Root> = function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties.href;
      if (typeof href !== "string" || !EXTERNAL_HREF_PATTERN.test(href)) return;
      node.properties.target = "_blank";
      // 新しいタブ側からwindow.openerを触られないようにする
      node.properties.rel = ["noopener", "noreferrer"];
    });
  };
};
