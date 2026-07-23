import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { ShikiTransformer } from "shiki";
import { unified } from "unified";
import { remarkDataLine } from "./remark-data-line.ts";

const DATA_LINE_MARKER_PATTERN = /data-mdecho-line-start="(\d+)" data-mdecho-line-end="(\d+)"/;

const restoreDataLineTransformer: ShikiTransformer = {
  name: "mdecho:restore-data-line",
  pre(node) {
    const raw = this.options.meta?.__raw ?? "";
    const match = DATA_LINE_MARKER_PATTERN.exec(raw);
    if (match?.[1] && match[2]) {
      node.properties["data-line"] = Number(match[1]);
      node.properties["data-line-end"] = Number(match[2]);
    }
    return node;
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDataLine)
  .use(remarkRehype)
  .use(rehypeShiki, {
    theme: "github-light",
    defaultLanguage: "text",
    fallbackLanguage: "text",
    onError: (error) => {
      console.error("[mdecho] shiki highlight error:", error);
    },
    transformers: [restoreDataLineTransformer],
  })
  .use(rehypeStringify);

export async function renderMarkdown(markdownSource: string): Promise<string> {
  const file = await processor.process(markdownSource);
  return String(file);
}
