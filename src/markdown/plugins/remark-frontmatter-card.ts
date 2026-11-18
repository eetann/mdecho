import { parseYAML } from "confbox/yaml";
import type { Element, ElementContent, Properties } from "hast";
import type { Code, Root } from "mdast";
import type {} from "mdast-util-to-hast";
import type { Plugin } from "unified";
import type { Data, Node } from "unist";

type Scalar = string | number | boolean | null;

function isScalar(value: unknown): value is Scalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseYAML(source: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: parseYAML(source) };
  } catch {
    return { ok: false };
  }
}

function text(value: string): ElementContent {
  return { type: "text", value };
}

function element(
  tagName: string,
  className: string[],
  children: ElementContent[],
  extra: Properties = {},
): Element {
  const properties: Properties = className.length > 0 ? { className, ...extra } : { ...extra };
  return { type: "element", tagName, properties, children };
}

function scalarToText(value: Scalar): string {
  return value === null ? "" : String(value);
}

/**
 * チップはliではなくspanで作る。カーソルの候補セレクタにliが含まれていて、
 * liにするとチップをクリックしたときにdata-lineを持たないliが拾われ、カーソルが動かなくなる。
 */
function chips(values: Scalar[]): ElementContent {
  if (values.length === 0) {
    return text("[]");
  }
  return element(
    "span",
    ["mdecho-frontmatter-chips"],
    values.map((item) => element("span", ["mdecho-frontmatter-chip"], [text(scalarToText(item))])),
  );
}

/** 1行ぶんの値を表示用に組み立てる。解釈できない形はソースの文字列のまま出す */
function renderValue(value: unknown, raw: string): ElementContent[] {
  if (isScalar(value)) {
    return [text(scalarToText(value))];
  }
  if (Array.isArray(value) && value.every(isScalar)) {
    return [chips(value)];
  }
  return [text(raw)];
}

type RowKind = "entry" | "continuation" | "comment";

interface Row {
  line: number;
  kind: RowKind;
  depth: number;
  key?: string;
  value: ElementContent[];
}

const BLOCK_SCALAR_PATTERN = /^[|>][-+0-9]*\s*(#.*)?$/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** `key: value`の1行を、キーと値(コロンの後ろの生の文字列も)に分ける。キーの行でなければundefined */
function parseEntryLine(content: string): { key: string; value: unknown; raw: string } | undefined {
  const parsed = tryParseYAML(content);
  if (!parsed.ok || !isPlainObject(parsed.value)) {
    return undefined;
  }
  const entries = Object.entries(parsed.value);
  if (entries.length !== 1) {
    return undefined;
  }
  const [key, value] = entries[0] as [string, unknown];
  const colon = content.indexOf(":");
  const raw = colon === -1 ? "" : content.slice(colon + 1).trim();
  return { key, value, raw };
}

/**
 * フロントマターのソースを1行ずつ表示用の行に変える。
 * 値をまとめてパースしてから並べると、どの表示がソースのどの行かが分からなくなる
 * (行ごとにカーソルやコメントを置けなくなる)ため、行単位で解釈する。
 * 空行は表示しない。本文の空行と同じく、その行番号は欠番になる。
 */
function toRows(source: string, firstLine: number): Row[] {
  const rows: Row[] = [];
  // 祖先のキーのインデント幅。ネストの深さを決めるのに使う
  const indentStack: number[] = [];
  // `|`や`>`で始まったブロックの中にいる間は、そのキーのインデント幅と中身の字下げ幅を持つ
  let block: { keyIndent: number; contentIndent?: number } | undefined;

  source.split("\n").forEach((line, index) => {
    const lineNumber = firstLine + index;
    const content = line.trim();
    const indent = indentOf(line);

    if (block !== undefined) {
      if (content.length === 0) {
        rows.push({ line: lineNumber, kind: "continuation", depth: 0, value: [] });
        return;
      }
      if (indent > block.keyIndent) {
        block.contentIndent ??= indent;
        const depth = indentStack.length;
        const dedented = line.slice(Math.min(indent, block.contentIndent));
        rows.push({ line: lineNumber, kind: "continuation", depth, value: [text(dedented)] });
        return;
      }
      block = undefined;
    }

    if (content.length === 0) {
      return;
    }
    if (content.startsWith("#")) {
      rows.push({ line: lineNumber, kind: "comment", depth: 0, value: [text(content)] });
      return;
    }

    while (indentStack.length > 0 && (indentStack.at(-1) as number) >= indent) {
      indentStack.pop();
    }
    const depth = indentStack.length;

    if (content === "-" || content.startsWith("- ")) {
      const parsed = tryParseYAML(content);
      const item = parsed.ok && Array.isArray(parsed.value) ? parsed.value[0] : undefined;
      const value = isScalar(item) ? [chips([item])] : [text(content)];
      rows.push({ line: lineNumber, kind: "continuation", depth, value });
      return;
    }

    const entry = parseEntryLine(content);
    if (entry === undefined) {
      // 複数行にまたがるフロー形式など、1行だけでは解釈できない行
      rows.push({ line: lineNumber, kind: "continuation", depth, value: [text(content)] });
      return;
    }

    indentStack.push(indent);
    if (BLOCK_SCALAR_PATTERN.test(entry.raw)) {
      block = { keyIndent: indent };
      rows.push({ line: lineNumber, kind: "entry", depth, key: entry.key, value: [] });
      return;
    }
    rows.push({
      line: lineNumber,
      kind: "entry",
      depth,
      key: entry.key,
      value: renderValue(entry.value, entry.raw),
    });
  });

  // ブロックの末尾の空行は、ソース上も意味を持たないので落とす
  while (
    rows.length > 0 &&
    rows.at(-1)?.kind === "continuation" &&
    rows.at(-1)?.value.length === 0
  ) {
    rows.pop();
  }
  return rows;
}

function rowToElement(row: Row): Element {
  const lineProps: Properties = {
    dataLine: row.line,
    dataLineEnd: row.line,
    style: row.depth > 0 ? `--mdecho-frontmatter-depth: ${row.depth}` : undefined,
  };
  if (row.kind === "comment") {
    return element(
      "div",
      ["mdecho-frontmatter-row", "mdecho-frontmatter-comment"],
      row.value,
      lineProps,
    );
  }
  const key = row.key ?? "";
  return element(
    "div",
    [
      "mdecho-frontmatter-row",
      ...(row.kind === "continuation" ? ["mdecho-frontmatter-continuation"] : []),
    ],
    [
      // 長いキーはCSSで省略するので、ホバーで全体が読めるようtitleにも入れる
      element("span", ["mdecho-frontmatter-key"], [text(key)], key ? { title: key } : {}),
      element("span", ["mdecho-frontmatter-value"], row.value),
    ],
    lineProps,
  );
}

/**
 * カードに置き換えたあとのノード。mdast-util-to-hastは`yaml`ノードを専用ハンドラで
 * 捨ててしまうため、`data.hName`が効くよう既定ハンドラの無い型に差し替える。
 * positionを持たせないのは、remarkDataLineにカード全体のdata-lineを付けさせないため
 * (カーソルやコメントの対象は、中の各行にする)。
 */
interface FrontmatterCard extends Node {
  type: "mdechoFrontmatter";
  data: Data & { hName: string; hProperties: Properties; hChildren: ElementContent[] };
}

declare module "mdast" {
  interface RootContentMap {
    mdechoFrontmatter: FrontmatterCard;
  }
}

/**
 * remark-frontmatterが作る`yaml`ノードを、1行ごとに「キー｜値」を横に並べたカードに変える。
 * トップレベルがマッピングでない、またはYAMLとしてパースできないときは
 * YAMLのコードブロックに変える(コードブロックなら行ごとのdata-lineが付く)。
 * 中身が空のフロントマターは何も出さない。
 * remarkDataLineより前に置くこと(コードブロックへ変えたものに行番号を付けてもらうため)。
 */
export const remarkFrontmatterCard: Plugin<[], Root> = function remarkFrontmatterCard() {
  return (tree: Root) => {
    // フロントマターは文書の先頭にしか現れない
    const node = tree.children[0];
    if (node?.type !== "yaml") {
      return;
    }
    if (node.value.trim().length === 0) {
      tree.children.shift();
      return;
    }

    const parsed = tryParseYAML(node.value);
    if (!parsed.ok || !isPlainObject(parsed.value) || node.position === undefined) {
      const code: Code = { type: "code", lang: "yaml", value: node.value, position: node.position };
      tree.children[0] = code;
      return;
    }

    // node.positionは開きの`---`の行から始まるので、中身は次の行から
    const rows = toRows(node.value, node.position.start.line + 1);
    const card: FrontmatterCard = {
      type: "mdechoFrontmatter",
      data: {
        hName: "div",
        hProperties: { className: ["mdecho-frontmatter"], role: "group", ariaLabel: "Frontmatter" },
        hChildren: rows.map(rowToElement),
      },
    };
    tree.children[0] = card;
  };
};
