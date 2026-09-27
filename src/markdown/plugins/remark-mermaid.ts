import type { Code, Root } from "mdast";
import type {} from "mdast-util-to-hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface MermaidCodeData {
  hName?: string;
  hProperties?: Record<string, unknown>;
  hChildren?: unknown[];
}

function isMermaidCode(node: Code): boolean {
  return node.lang?.toLowerCase() === "mermaid";
}

export const remarkMermaid: Plugin<[], Root> = function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (!isMermaidCode(node)) return;

      const data = (node.data ??= {}) as MermaidCodeData;
      const hProperties = (data.hProperties ??= {});
      const className = hProperties["className"];
      hProperties["className"] = Array.isArray(className)
        ? [...className, "mdecho-mermaid"]
        : ["mdecho-mermaid"];
      data.hName = "div";
      data.hChildren = [{ type: "text", value: node.value }];
    });
  };
};
