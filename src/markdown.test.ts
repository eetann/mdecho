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
