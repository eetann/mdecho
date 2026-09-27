import type { Root } from "mdast";
import type {} from "mdast-util-to-hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export const remarkDataLine: Plugin<[], Root> = function remarkDataLine() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type === "root" || !node.position) {
        return;
      }

      const data = node.data ?? (node.data = {});
      const hProperties = (data.hProperties ??= {});
      hProperties["data-line"] = node.position.start.line;
      hProperties["data-line-end"] = node.position.end.line;

      if (node.type === "code") {
        const marker = `data-mdecho-line-start="${node.position.start.line}" data-mdecho-line-end="${node.position.end.line}"`;
        node.meta = node.meta ? `${node.meta} ${marker}` : marker;
      }
    });
  };
};
