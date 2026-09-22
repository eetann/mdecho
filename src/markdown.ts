import rehypeShiki from "@shikijs/rehype";
import type { Heading, PhrasingContent } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { ShikiTransformer } from "shiki";
import { type PluggableList, unified } from "unified";
import { DEFAULT_LINE_BREAK, type LineBreakConfig } from "./config.ts";
import { rehypeExternalLinks } from "./rehype-external-links.ts";
import { rehypeHeadingId } from "./rehype-heading-id.ts";
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

/**
 * 本文用のプロセッサを、改行設定の組み合わせごとに組み立てる。
 * remarkSplitSentencesはremarkBreaksより前に置く必要がある
 * (句点直後の改行を、まだtextノード中の"\n"のうちに取り除くため)。
 */
function createBodyProcessor(lineBreak: LineBreakConfig) {
  const sentencePlugins: PluggableList = lineBreak.splitSentences ? [remarkSplitSentences] : [];
  const breakPlugins: PluggableList = lineBreak.singleNewline ? [remarkBreaks] : [];
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(sentencePlugins)
    .use(breakPlugins)
    .use(remarkDataLine)
    .use(remarkMermaid)
    .use(remarkRehype)
    .use(rehypeHeadingId)
    .use(rehypeExternalLinks)
    .use(rehypeShiki, { ...shikiOptions, transformers: [restoreDataLineTransformer] })
    .use(rehypeStringify);
}

// 組み合わせは4通りしかないので、一度組み立てたプロセッサを使い回す。
const bodyProcessors = new Map<string, ReturnType<typeof createBodyProcessor>>();

function getBodyProcessor(lineBreak: LineBreakConfig) {
  const key = `${lineBreak.splitSentences}/${lineBreak.singleNewline}`;
  let processor = bodyProcessors.get(key);
  if (processor === undefined) {
    processor = createBodyProcessor(lineBreak);
    bodyProcessors.set(key, processor);
  }
  return processor;
}

// コメント本文用。remarkDataLineを通さないため、本文と違いdata-line属性は付与されない
// (付与するとcursor-line-clientの行解決ロジックと衝突するため意図的に外している)。
const commentProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype)
  .use(rehypeExternalLinks)
  .use(rehypeShiki, shikiOptions)
  .use(rehypeStringify);

const titleProcessor = unified().use(remarkParse).use(remarkGfm);

function phrasingToText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if ("value" in node) {
        return node.value;
      }
      if ("children" in node) {
        return phrasingToText(node.children);
      }
      return "";
    })
    .join("");
}

/** 本文中で最初に登場するトップレベルh1見出しをページタイトルとして抽出する。無ければundefined。 */
export function extractTitle(markdownSource: string): string | undefined {
  const tree = titleProcessor.parse(markdownSource);
  const heading = tree.children.find(
    (node): node is Heading => node.type === "heading" && node.depth === 1,
  );
  if (!heading) {
    return undefined;
  }
  const title = phrasingToText(heading.children).trim();
  return title.length > 0 ? title : undefined;
}

export async function renderMarkdown(
  markdownSource: string,
  lineBreak: Partial<LineBreakConfig> = {},
): Promise<string> {
  const file = await getBodyProcessor({ ...DEFAULT_LINE_BREAK, ...lineBreak }).process(
    markdownSource,
  );
  return String(file);
}

export async function renderCommentMarkdown(commentSource: string): Promise<string> {
  const file = await commentProcessor.process(commentSource);
  return String(file);
}
