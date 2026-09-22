import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { isMarkdownPath, resolveDoc } from "./doc-path.ts";

const ENTRY = join(resolve("/tmp/mdecho-doc-path"), "docs", "index.md");
const BASE_DIR = join(resolve("/tmp/mdecho-doc-path"), "docs");

describe("isMarkdownPath", () => {
  test(".mdと.markdownをMarkdownとみなす", () => {
    expect(isMarkdownPath("foo.md")).toBe(true);
    expect(isMarkdownPath("sub/FOO.MD")).toBe(true);
    expect(isMarkdownPath("foo.markdown")).toBe(true);
  });

  test("それ以外の拡張子は対象外", () => {
    expect(isMarkdownPath("foo.png")).toBe(false);
    expect(isMarkdownPath("foo.md.txt")).toBe(false);
    expect(isMarkdownPath("md")).toBe(false);
  });
});

describe("resolveDoc", () => {
  test("ルートパスはエントリのファイルを指す", () => {
    expect(resolveDoc(ENTRY, "/")).toEqual({
      absPath: ENTRY,
      relPath: "index.md",
      displayPath: ENTRY,
    });
  });

  test("同じディレクトリのファイルを解決する", () => {
    expect(resolveDoc(ENTRY, "/foo.md")).toEqual({
      absPath: join(BASE_DIR, "foo.md"),
      relPath: "foo.md",
      displayPath: join(BASE_DIR, "foo.md"),
    });
  });

  test("サブディレクトリのファイルを解決する", () => {
    const resolved = resolveDoc(ENTRY, "/sub/bar.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "sub", "bar.md"));
    expect(resolved?.relPath).toBe("sub/bar.md");
  });

  test("パーセントエンコードされたパスをデコードする", () => {
    const resolved = resolveDoc(ENTRY, "/%E6%97%A5%E6%9C%AC%E8%AA%9E.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "日本語.md"));
    expect(resolved?.relPath).toBe("日本語.md");
  });

  test("`..`を含むパスを正規化する", () => {
    const resolved = resolveDoc(ENTRY, "/sub/../foo.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "foo.md"));
    expect(resolved?.relPath).toBe("foo.md");
  });

  test("エントリのディレクトリの外を指すパスは解決しない", () => {
    expect(resolveDoc(ENTRY, "/../secret.md")).toBeUndefined();
    expect(resolveDoc(ENTRY, "/sub/../../secret.md")).toBeUndefined();
    expect(resolveDoc(ENTRY, "/%2e%2e/secret.md")).toBeUndefined();
  });

  test("デコードできないパスとヌル文字入りのパスは解決しない", () => {
    expect(resolveDoc(ENTRY, "/%E3%81")).toBeUndefined();
    expect(resolveDoc(ENTRY, "/foo%00.md")).toBeUndefined();
  });

  test("エントリ以外のdisplayPathは`-f`のパスと同じ書き方になる", () => {
    expect(resolveDoc("docs/index.md", "/sub/bar.md")?.displayPath).toBe("docs/sub/bar.md");
    expect(resolveDoc("./index.md", "/sub/bar.md")?.displayPath).toBe("sub/bar.md");
  });

  test("エントリ自身のdisplayPathは`-f`に渡した表記のまま", () => {
    expect(resolveDoc("./docs/index.md", "/")?.displayPath).toBe("./docs/index.md");
    expect(resolveDoc("./docs/index.md", "/index.md")?.displayPath).toBe("./docs/index.md");
  });
});
