import GithubSlugger from "github-slugger";
import type { Element, ElementContent, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const HEADING_TAG_PATTERN = /^h[1-6]$/;

function toText(node: ElementContent | Element): string {
  if (node.type === "text") {
    return node.value;
  }
  if ("children" in node) {
    return node.children.map(toText).join("");
  }
  return "";
}

/**
 * 見出しにGitHubと同じ規則のidを振り、`#見出し`のページ内リンクを効くようにする。
 * Markdown中のリンクは書かれたままのフラグメント(`#my-heading`)になるため、
 * GitHub上で通用するアンカーがそのまま通るようslug生成はgithub-sluggerに任せている。
 *
 * コメント本文には適用しない。同じ見出しを書いたときに本文側のidと衝突してしまうため。
 */
export const rehypeHeadingId: Plugin<[], Root> = function rehypeHeadingId() {
  return (tree: Root) => {
    // 同じ見出しが複数あるときの連番(`概要-1`)はドキュメント単位で数える。
    const slugger = new GithubSlugger();
    visit(tree, "element", (node) => {
      if (!HEADING_TAG_PATTERN.test(node.tagName)) return;
      const text = toText(node).trim();
      if (text === "") return;
      node.properties.id = slugger.slug(text);
    });
  };
};
