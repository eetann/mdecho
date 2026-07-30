import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { ShikiTransformer } from "shiki";
import { unified } from "unified";
import { remarkDataLine } from "./remark-data-line.ts";
import { remarkMermaid } from "./remark-mermaid.ts";
import { remarkSplitSentences } from "./remark-split-sentences.ts";

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
  line(node, line) {
    const raw = this.options.meta?.__raw ?? "";
    const match = DATA_LINE_MARKER_PATTERN.exec(raw);
    if (match?.[1]) {
      node.properties["data-line"] = Number(match[1]) + line;
    }
    return node;
  },
};

const shikiOptions = {
  theme: "github-light",
  defaultLanguage: "text",
  fallbackLanguage: "text",
  onError: (error: unknown) => {
    console.error("[mdecho] shiki highlight error:", error);
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkDataLine)
  .use(remarkMermaid)
  .use(remarkRehype)
  .use(rehypeShiki, { ...shikiOptions, transformers: [restoreDataLineTransformer] })
  .use(rehypeStringify);

const processorSplitSentences = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkSplitSentences)
  .use(remarkBreaks)
  .use(remarkDataLine)
  .use(remarkMermaid)
  .use(remarkRehype)
  .use(rehypeShiki, { ...shikiOptions, transformers: [restoreDataLineTransformer] })
  .use(rehypeStringify);

// コメント本文用。remarkDataLineを通さないため、本文と違いdata-line属性は付与されない
// (付与するとcursor-line-clientの行解決ロジックと衝突するため意図的に外している)。
const commentProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype)
  .use(rehypeShiki, shikiOptions)
  .use(rehypeStringify);

export async function renderMarkdown(
  markdownSource: string,
  options: { splitSentences?: boolean } = {},
): Promise<string> {
  const { splitSentences = true } = options;
  const file = await (splitSentences ? processorSplitSentences : processor).process(markdownSource);
  return String(file);
}

export async function renderCommentMarkdown(commentSource: string): Promise<string> {
  const file = await commentProcessor.process(commentSource);
  return String(file);
}
