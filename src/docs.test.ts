import { describe, expect, test } from "bun:test";
import { listDocs, parseFrontmatterDescription, readDoc } from "./docs.ts";

describe("parseFrontmatterDescription", () => {
  test("frontmatterからdescriptionを抽出する", () => {
    const source = "---\ndescription: テストの説明\n---\n\n# 見出し\n本文";
    const { description, body } = parseFrontmatterDescription(source);
    expect(description).toBe("テストの説明");
    expect(body).toBe("# 見出し\n本文");
  });

  test("frontmatterがない場合は空のdescriptionとそのままの本文を返す", () => {
    const source = "# 見出し\n本文";
    const { description, body } = parseFrontmatterDescription(source);
    expect(description).toBe("");
    expect(body).toBe(source);
  });

  test("frontmatterにdescriptionがない場合は空文字を返す", () => {
    const source = "---\nother: value\n---\n本文";
    const { description, body } = parseFrontmatterDescription(source);
    expect(description).toBe("");
    expect(body).toBe("本文");
  });

  test("閉じの---がない場合はfrontmatterなし扱いにする", () => {
    const source = "---\ndescription: 未閉鎖\n本文";
    const { description, body } = parseFrontmatterDescription(source);
    expect(description).toBe("");
    expect(body).toBe(source);
  });
});

describe("listDocs", () => {
  test("docs/配下の.mdファイルをname順に列挙する", async () => {
    const entries = await listDocs();
    const names = entries.map((e) => e.name);
    expect(names).toContain("getting-started");
    expect(names).toContain("agent-workflow");
    expect(names).toContain("troubleshooting");
    expect(names).toContain("cli-reference");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("各エントリはdescriptionを持つ", async () => {
    const entries = await listDocs();
    for (const entry of entries) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe("readDoc", () => {
  test("存在するdocの本文を返す", async () => {
    const result = await readDoc("getting-started");
    expect(result).toBeDefined();
    expect(result?.entry.name).toBe("getting-started");
    expect(result?.body).toContain("# 基本的な使い方");
  });

  test(".md拡張子付きでも解決できる", async () => {
    const result = await readDoc("getting-started.md");
    expect(result).toBeDefined();
    expect(result?.entry.name).toBe("getting-started");
  });

  test("存在しないdoc名はundefinedを返す", async () => {
    const result = await readDoc("not-exist-doc");
    expect(result).toBeUndefined();
  });

  test("パストラバーサルを含む名前はundefinedを返す", async () => {
    expect(await readDoc("../package.json")).toBeUndefined();
    expect(await readDoc("../../etc/passwd")).toBeUndefined();
    expect(await readDoc("sub/dir")).toBeUndefined();
  });
});
