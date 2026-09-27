import { describe, expect, test } from "bun:test";
import { extractTitle, renderCommentMarkdown, renderMarkdown } from "./render.ts";

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

  test("singleNewline:falseなら単一改行が<br>にならない", async () => {
    const html = await renderMarkdown("1行目\n2行目", { singleNewline: false });

    expect(html).not.toContain("<br>");
    expect(html).toContain("1行目");
    expect(html).toContain("2行目");
  });

  test("singleNewline:falseでも句点分割は効く", async () => {
    const html = await renderMarkdown("AはBです。そしてBがCなのです。", {
      singleNewline: false,
    });

    expect(html).toContain('<span class="mdecho-sentence"');
    expect(html.match(/mdecho-sentence/g)).toHaveLength(2);
  });

  test("両方falseなら単一改行はMarkdown本来どおり1段落へつながる", async () => {
    const html = await renderMarkdown("AはBです。\nそしてBがCなのです。", {
      splitSentences: false,
      singleNewline: false,
    });

    expect(html).not.toContain("<br>");
    expect(html).not.toContain("mdecho-sentence");
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

describe("extractTitle", () => {
  test("先頭のh1見出しをタイトルとして抽出する", () => {
    expect(extractTitle("# 見出し\n\n本文")).toBe("見出し");
  });

  test("h1がインライン要素を含む場合はテキストのみを抽出する", () => {
    expect(extractTitle("# **太字**と`コード`のタイトル")).toBe("太字とコードのタイトル");
  });

  test("h1が無ければundefinedを返す", () => {
    expect(extractTitle("## 見出し2\n\n本文")).toBeUndefined();
    expect(extractTitle("本文のみ")).toBeUndefined();
  });

  test("h1が本文の途中にある場合でも最初のh1を抽出する", () => {
    expect(extractTitle("本文\n\n# 見出し")).toBe("見出し");
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

describe("renderMarkdown - links", () => {
  test("httpsリンクは新しいタブで開くようtarget/relが付く", async () => {
    const html = await renderMarkdown("[example](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("httpリンクも同様に扱う", async () => {
    const html = await renderMarkdown("[example](http://example.com)");
    expect(html).toContain('target="_blank"');
  });

  test("自動リンク(<https://...>)にもtargetが付く", async () => {
    const html = await renderMarkdown("<https://example.com>");
    expect(html).toContain('target="_blank"');
  });

  test("./foo.mdのような相対リンクにはtargetを付けない(同じタブでmdechoが開くため)", async () => {
    const html = await renderMarkdown("[doc](./foo.md)");
    expect(html).toContain('href="./foo.md"');
    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  test("ページ内リンク(#見出し)も変更しない", async () => {
    const html = await renderMarkdown("[jump](#heading)");
    expect(html).toContain('href="#heading"');
    expect(html).not.toContain("target=");
  });

  test("mailto:リンクも変更しない", async () => {
    const html = await renderMarkdown("[mail](mailto:foo@example.com)");
    expect(html).not.toContain("target=");
  });

  test("splitSentences:falseでも同じくtargetが付く", async () => {
    const html = await renderMarkdown("[example](https://example.com)", { splitSentences: false });
    expect(html).toContain('target="_blank"');
  });

  test("コメント本文のhttpsリンクも新しいタブで開く", async () => {
    const html = await renderCommentMarkdown("[example](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe("renderMarkdown - heading id", () => {
  test("見出しにGitHubと同じ規則のidが付く", async () => {
    const html = await renderMarkdown("## My Heading!");
    expect(html).toContain('id="my-heading"');
  });

  test("日本語の見出しはそのままidになり、Markdownに書いたアンカーと一致する", async () => {
    const html = await renderMarkdown("[jump](#みだし2)\n\n## みだし2");
    expect(html).toContain('id="みだし2"');
  });

  test("同じ見出しが複数あるときは連番が付く", async () => {
    const html = await renderMarkdown("## 概要\n\n## 概要");
    expect(html).toContain('id="概要"');
    expect(html).toContain('id="概要-1"');
  });

  test("h1からh6まで振る", async () => {
    const html = await renderMarkdown("# a\n\n## b\n\n### c\n\n#### d\n\n##### e\n\n###### f");
    for (const name of ["a", "b", "c", "d", "e", "f"]) {
      expect(html).toContain(`id="${name}"`);
    }
  });

  test("コメント本文の見出しにはidを付けない(本文側と衝突するため)", async () => {
    const html = await renderCommentMarkdown("## My Heading");
    expect(html).toContain("<h2");
    expect(html).not.toContain("id=");
  });
});
