import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "./config.ts";
import { startServer, type StartServerResult } from "./server.ts";

// 句点分割はレンダリング結果のHTMLを膨らませるだけなので、関係ないテストでは切っておく。
const NO_SPLIT = { splitSentences: false };

// styles.cssのセレクタにも同じ文字列が現れるため、JSON埋め込みされたbodyHtml側の
// spanだけを見分けられるようにエスケープ後の形で比べる。
const SENTENCE_SPAN = 'class=\\"mdecho-sentence\\"';

let running: StartServerResult | undefined;
let dir: string | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe("startServer", () => {
  test("Markdownと同じディレクトリの画像を配信する", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await writeFile(join(dir, "pic.png"), pngBytes);
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n\n![画像](./pic.png)\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    const indexRes = await fetch(running.url);
    const html = await indexRes.text();
    // bodyHtmlはJSON埋め込み時に"<"が"\u003c"へエスケープされるため、その後ろの部分だけ検証する
    expect(html).toContain('img src=\\"./pic.png\\"');

    const imageRes = await fetch(new URL("./pic.png", running.url));
    expect(imageRes.status).toBe(200);
    expect(imageRes.headers.get("content-type")).toBe("image/png");
    expect(await imageRes.bytes()).toEqual(pngBytes);
  });

  test("設定したフォントを<head>のCSSとして注入する", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");

    running = await startServer(filePath, {
      lineBreakOverride: NO_SPLIT,
      config: { ...DEFAULT_CONFIG, font: { body: ["Inter"], code: ["JetBrains Mono"] } },
    });

    const html = await (await fetch(running.url)).text();
    expect(html).toContain("--font-sans: Inter, var(--mdecho-default-font-body);");
    expect(html).toContain('--font-mono: "JetBrains Mono", var(--mdecho-default-font-code);');
    // styles.cssより後に置かれないと上書きできない
    expect(html.indexOf("mdecho-config-style")).toBeGreaterThan(
      html.indexOf("--mdecho-default-font-body:"),
    );
  });

  test("フォント未設定なら余計なstyleを注入しない", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    const html = await (await fetch(running.url)).text();
    expect(html).not.toContain("mdecho-config-style");
  });

  test("設定モーダル用の設定を初期データに埋め込む", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");
    const configFile = join(dir, "config.jsonc");

    running = await startServer(filePath, {
      lineBreakOverride: NO_SPLIT,
      config: { ...DEFAULT_CONFIG, font: { body: ["Inter"], code: [] } },
      configFile,
    });

    const html = await (await fetch(running.url)).text();
    expect(html).toContain('"editable":true');
    expect(html).toContain('"body":["Inter"]');
  });

  test("POST /api/configが設定ファイルへ書き込み、以降の表示にも反映する", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");
    const configFile = join(dir, "config.jsonc");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT, configFile });

    const res = await fetch(new URL("./api/config", running.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ font: { body: ["Meiryo"], code: ["Consolas"] } }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      font: { body: ["Meiryo"], code: ["Consolas"] },
      lineBreak: { splitSentences: true, singleNewline: true },
      warnings: [],
    });
    expect(JSON.parse(await readFile(configFile, "utf-8"))).toEqual({
      font: { body: ["Meiryo"], code: ["Consolas"] },
      lineBreak: { splitSentences: true, singleNewline: true },
    });

    const html = await (await fetch(running.url)).text();
    expect(html).toContain("--font-sans: Meiryo, var(--mdecho-default-font-body);");
  });

  test("POST /api/configは使えないフォント名を弾いて警告を返す", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");
    const configFile = join(dir, "config.jsonc");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT, configFile });

    const res = await fetch(new URL("./api/config", running.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ font: { body: ["Meiryo (メイリオ)", "Inter"] } }),
    });
    const body = (await res.json()) as { font: { body: string[] }; warnings: string[] };
    expect(body.font.body).toEqual(["Inter"]);
    expect(body.warnings).toHaveLength(1);
  });

  test("書き戻せない形式の設定ファイルならPOST /api/configを拒否する", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");

    running = await startServer(filePath, {
      lineBreakOverride: NO_SPLIT,
      configFile: join(dir, "config.yaml"),
    });

    const html = await (await fetch(running.url)).text();
    expect(html).toContain('"editable":false');

    const res = await fetch(new URL("./api/config", running.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ font: { body: ["Meiryo"] } }),
    });
    expect(res.status).toBe(400);
  });

  test("設定ファイルのlineBreakがレンダリングに効く", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "AはBです。そしてBがCなのです。\n");

    running = await startServer(filePath, {
      config: { ...DEFAULT_CONFIG, lineBreak: { splitSentences: false, singleNewline: true } },
    });

    const html = await (await fetch(running.url)).text();
    expect(html).not.toContain(SENTENCE_SPAN);
    expect(html).toContain('"lineBreak":{"splitSentences":false,"singleNewline":true}');
  });

  test("CLIフラグは設定ファイルより優先され、保存後も優先され続ける", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "AはBです。そしてBがCなのです。\n");
    const configFile = join(dir, "config.jsonc");

    running = await startServer(filePath, {
      config: { ...DEFAULT_CONFIG, lineBreak: { splitSentences: true, singleNewline: true } },
      lineBreakOverride: NO_SPLIT,
      configFile,
    });

    expect(await (await fetch(running.url)).text()).not.toContain(SENTENCE_SPAN);

    // モーダルからsplitSentences:trueを保存しても、CLIで明示した指定を上書きしない
    const res = await fetch(new URL("./api/config", running.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lineBreak: { splitSentences: true, singleNewline: true } }),
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(await readFile(configFile, "utf-8")).lineBreak).toEqual({
      splitSentences: true,
      singleNewline: true,
    });

    expect(await (await fetch(running.url)).text()).not.toContain(SENTENCE_SPAN);
  });

  test("CLIで上書きした項目を初期データに含める", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    const html = await (await fetch(running.url)).text();
    expect(html).toContain('"lineBreakOverride":{"splitSentences":false}');
  });

  test("POST /api/configでlineBreakだけ変えても以降の表示に反映する", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "AはBです。そしてBがCなのです。\n");
    const configFile = join(dir, "config.jsonc");

    running = await startServer(filePath, { configFile });
    expect(await (await fetch(running.url)).text()).toContain(SENTENCE_SPAN);

    const res = await fetch(new URL("./api/config", running.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lineBreak: { splitSentences: false, singleNewline: false } }),
    });
    expect(res.status).toBe(200);

    expect(await (await fetch(running.url)).text()).not.toContain(SENTENCE_SPAN);
  });

  test("`./foo.md`のような相対リンク先も同じサーバーでレンダリングする", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# エントリ\n\n[foo](./foo.md)\n");
    await writeFile(join(dir, "foo.md"), "# foo\n\nfooの本文\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    const res = await fetch(new URL("./foo.md", running.url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("fooの本文");
    expect(html).toContain("<title>foo</title>");
  });

  test("リンク先のクリップボード用パスと相対パスを初期データに埋め込む", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# エントリ\n");
    await mkdir(join(dir, "sub"));
    await writeFile(join(dir, "sub", "bar.md"), "# bar\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    const html = await (await fetch(new URL("./sub/bar.md", running.url))).text();
    // AIエージェントに渡す参照は、-fに渡したパスと同じ書き方のまま表示中ファイルを指す
    expect(html).toContain(JSON.stringify(join(dir, "sub", "bar.md")).slice(1, -1));
    expect(html).toContain('"relPath":"sub/bar.md"');
    expect(html).toContain('"entryRelPath":"doc.md"');
  });

  test("エントリのディレクトリの外にあるファイルは開けない", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    await writeFile(join(dir, "secret.md"), "# ひみつ\n");
    await mkdir(join(dir, "docs"));
    const filePath = join(dir, "docs", "doc.md");
    await writeFile(filePath, "# エントリ\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    const res = await fetch(new URL("./%2e%2e/secret.md", running.url));
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("ひみつ");
  });

  test("存在しないパスは404を返す", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n\n本文\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    for (const path of ["./not-exist.png", "./not-exist.md"]) {
      const res = await fetch(new URL(path, running.url));
      expect(res.status).toBe(404);
      const html = await res.text();
      // エントリのファイルへ戻る導線だけ出す
      expect(html).toContain("doc.md に戻る");
      expect(html).not.toContain("本文");
    }
  });

  test("リンク先を開いたタブにも、そのファイルの変更を通知する", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# エントリ\n");
    const linkedPath = join(dir, "foo.md");
    await writeFile(linkedPath, "# foo\n");

    running = await startServer(filePath, { lineBreakOverride: NO_SPLIT });

    const res = await fetch(new URL("./events?path=%2Ffoo.md", running.url));
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    // 監視対象への追加が済む前の書き込みは取りこぼすため、届くまで書き換え続ける。
    // 通知側のデバウンスより間隔を長くしないと、待ち続けても発火しない。
    const touch = setInterval(() => {
      void writeFile(linkedPath, `# foo ${Date.now()}\n`);
    }, 500);
    try {
      let received = "";
      while (!received.includes("event: reload")) {
        const { value, done } = await reader.read();
        if (done) break;
        received += new TextDecoder().decode(value);
      }
      expect(received).toContain("event: reload");
    } finally {
      clearInterval(touch);
      await reader.cancel();
    }
  });
});
