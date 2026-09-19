import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
