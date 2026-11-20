import { describe, expect, test } from "bun:test";
import { extractTitle, renderMarkdown } from "../render.ts";

function row(line: number, key: string, value: string, extra = ""): string {
  const title = key ? ` title="${key}"` : "";
  return `<div class="mdecho-frontmatter-row" data-line="${line}" data-line-end="${line}"${extra}><span class="mdecho-frontmatter-key"${title}>${key}</span><span class="mdecho-frontmatter-value">${value}</span></div>`;
}

describe("remarkFrontmatterCard", () => {
  test("フロントマターを見出しや区切り線にせず、1行ごとにキーと値を並べる", async () => {
    const html = await renderMarkdown("---\ntitle: Hello\nstatus: draft\n---\n\n本文");
    expect(html).not.toContain("<hr");
    expect(html).not.toContain("<h2");
    expect(html).toContain(
      `<div class="mdecho-frontmatter" role="group" aria-label="Frontmatter">${row(2, "title", "Hello")}${row(3, "status", "draft")}</div>`,
    );
    expect(html).toContain('<p data-line="6" data-line-end="6">本文</p>');
  });

  test("カード全体にはdata-lineを付けない(カーソルやコメントの対象は各行)", async () => {
    const html = await renderMarkdown("---\ntitle: Hello\n---\n");
    expect(html).toContain('<div class="mdecho-frontmatter" role="group"');
    expect(html).not.toMatch(/class="mdecho-frontmatter"[^>]*data-line/);
  });

  test("フロー形式の配列はチップとして並べる", async () => {
    const html = await renderMarkdown("---\ntags: [a, b]\n---\n");
    expect(html).toContain(
      row(
        2,
        "tags",
        '<span class="mdecho-frontmatter-chips"><span class="mdecho-frontmatter-chip">a</span><span class="mdecho-frontmatter-chip">b</span></span>',
      ),
    );
  });

  test("ブロック形式のリストは要素ごとに1行ずつ、続きの行として出す", async () => {
    const html = await renderMarkdown("---\nreviewers:\n  - alice\n  - bob\n---\n");
    expect(html).toContain(row(2, "reviewers", ""));
    expect(html).toContain(
      '<div class="mdecho-frontmatter-row mdecho-frontmatter-continuation" data-line="3" data-line-end="3" style="--mdecho-frontmatter-depth: 1"><span class="mdecho-frontmatter-key"></span><span class="mdecho-frontmatter-value"><span class="mdecho-frontmatter-chips"><span class="mdecho-frontmatter-chip">alice</span></span></span></div>',
    );
    expect(html).toContain('data-line="4" data-line-end="4"');
  });

  test("複数行の値は1行ずつ、字下げを外して続きの行として出す", async () => {
    const html = await renderMarkdown("---\ndesc: |\n  line1\n    line2\nnext: x\n---\n");
    expect(html).toContain(row(2, "desc", ""));
    expect(html).toContain(
      'data-line="3" data-line-end="3" style="--mdecho-frontmatter-depth: 1"><span class="mdecho-frontmatter-key"></span><span class="mdecho-frontmatter-value">line1</span>',
    );
    expect(html).toContain('<span class="mdecho-frontmatter-value">  line2</span>');
    expect(html).toContain(row(5, "next", "x"));
  });

  test("ネストしたキーは深さを付けて自分の行に出す", async () => {
    const html = await renderMarkdown("---\nmeta:\n  author: eetann\n---\n");
    expect(html).toContain(row(2, "meta", ""));
    expect(html).toContain(row(3, "author", "eetann", ' style="--mdecho-frontmatter-depth: 1"'));
  });

  test("引用符は外し、値はエスケープする", async () => {
    const html = await renderMarkdown('---\ntitle: "<script>alert(1)</script>"\n---\n');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&#x3C;script>alert(1)&#x3C;/script>");
    expect(html).not.toContain('"&#x3C;script');
  });

  test("コメント行はそのまま1行として出す", async () => {
    const html = await renderMarkdown("---\n# memo\ntitle: x\n---\n");
    expect(html).toContain(
      '<div class="mdecho-frontmatter-row mdecho-frontmatter-comment" data-line="2" data-line-end="2"># memo</div>',
    );
  });

  test("空行は出さない", async () => {
    const html = await renderMarkdown("---\na: 1\n\nb: 2\n---\n");
    expect(html).toContain(row(2, "a", "1"));
    expect(html).toContain(row(4, "b", "2"));
    expect(html).not.toContain('data-line="3"');
  });

  test("トップレベルがマッピングでなければ、行番号付きのYAMLコードブロックにする", async () => {
    const html = await renderMarkdown("---\n- a\n---\n");
    expect(html).not.toContain("mdecho-frontmatter");
    expect(html).toMatch(/<pre class="shiki[^"]*"[^>]*data-line="1" data-line-end="3"/);
  });

  test("パースできないYAMLはYAMLコードブロックにする", async () => {
    const html = await renderMarkdown("---\nfoo: [\n---\n");
    expect(html).not.toContain("mdecho-frontmatter");
    expect(html).toContain('<pre class="shiki');
  });

  test("空のフロントマターは何も出さない", async () => {
    const html = await renderMarkdown("---\n---\n本文");
    expect(html).not.toContain("mdecho-frontmatter");
    expect(html).not.toContain("<hr");
    expect(html).toContain('<p data-line="3" data-line-end="3">本文</p>');
  });

  test("先頭以外の---で囲まれた部分はフロントマター扱いしない", async () => {
    const html = await renderMarkdown("本文\n\n---\ntitle: x\n---\n");
    expect(html).not.toContain("mdecho-frontmatter");
  });

  test("extractTitleはフロントマターを見出しとみなさない", () => {
    expect(extractTitle("---\ntitle: x\n---\n\n## sub")).toBeUndefined();
    expect(extractTitle("---\ntitle: x\n---\n\n# 本文の見出し")).toBe("本文の見出し");
  });
});
