import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type StartServerResult } from "./server.ts";

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

    running = await startServer(filePath, { splitSentences: false });

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
      splitSentences: false,
      config: { font: { body: ["Inter"], code: ["JetBrains Mono"] } },
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

    running = await startServer(filePath, { splitSentences: false });

    const html = await (await fetch(running.url)).text();
    expect(html).not.toContain("mdecho-config-style");
  });

  test("設定モーダル用の設定を初期データに埋め込む", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");
    const configFile = join(dir, "config.jsonc");

    running = await startServer(filePath, {
      splitSentences: false,
      config: { font: { body: ["Inter"], code: [] } },
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

    running = await startServer(filePath, { splitSentences: false, configFile });

    const res = await fetch(new URL("./api/config", running.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ font: { body: ["Meiryo"], code: ["Consolas"] } }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      font: { body: ["Meiryo"], code: ["Consolas"] },
      warnings: [],
    });
    expect(JSON.parse(await readFile(configFile, "utf-8"))).toEqual({
      font: { body: ["Meiryo"], code: ["Consolas"] },
    });

    const html = await (await fetch(running.url)).text();
    expect(html).toContain("--font-sans: Meiryo, var(--mdecho-default-font-body);");
  });

  test("POST /api/configは使えないフォント名を弾いて警告を返す", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n");
    const configFile = join(dir, "config.jsonc");

    running = await startServer(filePath, { splitSentences: false, configFile });

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
      splitSentences: false,
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

  test("存在しないパスはmarkdownのレンダリング結果にフォールバックする", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-test-"));
    const filePath = join(dir, "doc.md");
    await writeFile(filePath, "# タイトル\n\n本文\n");

    running = await startServer(filePath, { splitSentences: false });

    const res = await fetch(new URL("./not-exist.png", running.url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
