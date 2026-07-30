import { describe, expect, test } from "bun:test";
import { renderCommentMarkdown, renderMarkdown } from "./markdown.ts";

describe("renderMarkdown - line breaks", () => {
  test("単一改行(Enter1回)がそのまま<br>になる", async () => {
    const html = await renderMarkdown("1行目\n2行目");
    expect(html).toContain("<br");
    expect(html.match(/<p/g)?.length).toBe(1);
  });

  test("空行による段落分割は引き続き機能する", async () => {
    const html = await renderMarkdown("段落1\n\n段落2");
    expect(html.match(/<p/g)?.length).toBe(2);
    expect(html).not.toContain("<br");
  });

  test("行末スペース2個による従来のhard breakも引き続き機能する", async () => {
    const html = await renderMarkdown("1行目  \n2行目");
    expect(html).toContain("<br");
    expect(html.match(/<p/g)?.length).toBe(1);
  });

  test("コードブロック内の改行は<br>化されない", async () => {
    const source = "```\nline1\nline2\n```";
    const html = await renderMarkdown(source);
    expect(html).not.toContain("<br");
    expect(html).toContain("line1");
    expect(html).toContain("line2");
  });

  test("GFMテーブルが壊れない", async () => {
    const source = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const html = await renderMarkdown(source);
    expect(html).toContain("<table");
    expect(html).toContain("<td");
  });

  test("リスト内の改行がbrになっても<li>構造は壊れない", async () => {
    const source = "- 項目1\n  続き\n- 項目2";
    const html = await renderMarkdown(source);
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).toContain("<br");
  });

  test("段落のdata-line/data-line-endは改行挿入の影響を受けない", async () => {
    const html = await renderMarkdown("1行目\n2行目\n\n次の段落");
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-line-end="2"');
  });
});

describe("renderMarkdown - sentence split", () => {
  test("デフォルトで句点ごとに.mdecho-sentenceへ分割される", async () => {
    const html = await renderMarkdown("AAA。BBB。CCC。DDD。");
    expect(html.match(/class="mdecho-sentence"/g)?.length).toBe(4);
    expect(html).toContain('<p data-line="1" data-line-end="1">');
    expect(html.match(/data-line="1"/g)?.length).toBe(5); // p + 4 spans
  });

  test("splitSentences:falseを指定すると分割されない", async () => {
    const html = await renderMarkdown("AAA。BBB。CCC。DDD。", { splitSentences: false });
    expect(html).not.toContain("mdecho-sentence");
    expect(html).toContain("AAA。BBB。CCC。DDD。");
  });

  test("句点が1つだけの単文段落は分割されない", async () => {
    const html = await renderMarkdown("Hello world。");
    expect(html).not.toContain("mdecho-sentence");
  });

  test("句点が皆無の段落は分割されない", async () => {
    const html = await renderMarkdown("句点なしの文章");
    expect(html).not.toContain("mdecho-sentence");
  });

  test("見出しは分割対象外", async () => {
    const html = await renderMarkdown("# 見出し。テスト。");
    expect(html).not.toContain("mdecho-sentence");
    expect(html).toContain("見出し。テスト。");
  });

  test("テーブルセルは分割対象外", async () => {
    const html = await renderMarkdown("| a |\n| --- |\n| AAA。BBB。 |");
    expect(html).not.toContain("mdecho-sentence");
    expect(html).toContain("AAA。BBB。");
  });

  test("コードブロック内の句点は分割されない", async () => {
    const html = await renderMarkdown("```\nAAA。BBB。\n```");
    expect(html).not.toContain("mdecho-sentence");
  });

  test("インラインコード内の句点は分割されず、周囲の文は分割される", async () => {
    const html = await renderMarkdown("前置き。`code。inline。` 続き。");
    const sentenceCount = html.match(/class="mdecho-sentence"/g)?.length ?? 0;
    expect(sentenceCount).toBe(2);
    expect(html).toContain("<code");
    expect(html).toContain("code。inline。");
  });

  test("リスト項目内でも分割される", async () => {
    const html = await renderMarkdown("- 項目1。項目2。\n- 項目3");
    expect(html.match(/class="mdecho-sentence"/g)?.length).toBe(2);
    expect(html.match(/<li/g)?.length).toBe(2);
  });

  test("blockquote内でも分割される", async () => {
    const html = await renderMarkdown("> 引用A。引用B。");
    expect(html.match(/class="mdecho-sentence"/g)?.length).toBe(2);
    expect(html).toContain("<blockquote");
  });

  test("remark-breaksをまたぐ文はdata-lineとdata-line-endが異なる値になる", async () => {
    const html = await renderMarkdown("AAA。まだ続く\n続き終わり。BBB。");
    expect(html).toContain('data-line="1" data-line-end="2"');
    expect(html).toContain("<br");
  });

  test("句点直後の単一改行は次の文の先頭から取り除かれ、<br>にならない", async () => {
    const html = await renderMarkdown("AはBです。\nそしてBがCなのです。");
    expect(html).not.toContain("<br");
    expect(html).toContain(
      '<span class="mdecho-sentence" data-line="1" data-line-end="1">AはBです。</span>',
    );
    expect(html).toContain(
      '<span class="mdecho-sentence" data-line="2" data-line-end="2">そしてBがCなのです。</span>',
    );
  });

  test("句点直後のhard break(行末スペース2個)も次の文の先頭から取り除かれる", async () => {
    const html = await renderMarkdown("AはBです。  \nそしてBがCなのです。");
    expect(html).not.toContain("<br");
    expect(html).toContain(
      '<span class="mdecho-sentence" data-line="2" data-line-end="2">そしてBがCなのです。</span>',
    );
  });

  test("renderCommentMarkdownは文分割の影響を受けない", async () => {
    const html = await renderCommentMarkdown("AAA。BBB。CCC。");
    expect(html).not.toContain("mdecho-sentence");
  });
});

describe("renderMarkdown - mermaid", () => {
  test("本文のmermaidコードブロックはMermaid描画用コンテナになる", async () => {
    const html = await renderMarkdown("```mermaid\ngraph TD\n  A --> B\n```");
    expect(html).toContain('class="mdecho-mermaid"');
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-line-end="4"');
    expect(html).toContain("graph TD");
    expect(html).not.toContain("language-mermaid");
  });

  test("通常のコードブロックは従来どおりコード表示になる", async () => {
    const html = await renderMarkdown("```ts\nconst x = 1;\n```");
    expect(html).not.toContain("mdecho-mermaid");
    expect(html).toContain("<pre");
    expect(html).toContain("const");
  });

  test("コメント本文のmermaidコードブロックはMermaid描画用コンテナにならない", async () => {
    const html = await renderCommentMarkdown("```mermaid\ngraph TD\n  A --> B\n```");
    expect(html).not.toContain("mdecho-mermaid");
    expect(html).toContain("<pre");
  });
});

describe("renderCommentMarkdown - line breaks", () => {
  test("コメント本文でも単一改行が<br>になる", async () => {
    const html = await renderCommentMarkdown("1行目\n2行目");
    expect(html).toContain("<br");
  });

  test("コメント本文にはdata-line属性が付与されない(既存仕様の維持)", async () => {
    const html = await renderCommentMarkdown("1行目\n2行目");
    expect(html).not.toContain("data-line");
  });
});
