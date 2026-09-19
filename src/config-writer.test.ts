import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFontEdits, isWritableConfigFile, saveFontConfig } from "./config-writer.ts";

let dir: string | undefined;

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe("isWritableConfigFile", () => {
  test("JSONCとJSONだけ書き戻せる", () => {
    expect(isWritableConfigFile("/x/config.jsonc")).toBe(true);
    expect(isWritableConfigFile("/x/config.json")).toBe(true);
    expect(isWritableConfigFile("/x/config.yaml")).toBe(false);
    expect(isWritableConfigFile("/x/config.ts")).toBe(false);
  });
});

describe("applyFontEdits", () => {
  test("コメントと末尾カンマを保ったままfontだけ差し替える", () => {
    const source = `{
  // 本文のフォント
  "font": {
    "body": ["Inter"],
    /* コードブロック */
    "code": ["JetBrains Mono"],
  },
}
`;

    const updated = applyFontEdits(source, { body: ["Noto Sans JP"], code: ["Cascadia Code"] });

    expect(updated).toContain("// 本文のフォント");
    expect(updated).toContain("/* コードブロック */");
    expect(updated).toContain('"Noto Sans JP"');
    expect(updated).toContain('"Cascadia Code"');
    expect(updated).not.toContain("Inter");
    expect(updated).not.toContain("JetBrains Mono");
  });

  test("font以外のキーは残す", () => {
    const updated = applyFontEdits('{ "future": { "a": 1 } }', { body: ["Inter"], code: [] });

    expect(JSON.parse(updated)).toEqual({ future: { a: 1 }, font: { body: ["Inter"], code: [] } });
  });

  test("空の内容からでも設定を組み立てる", () => {
    const updated = applyFontEdits("", { body: ["Inter"], code: ["Consolas"] });

    expect(JSON.parse(updated)).toEqual({ font: { body: ["Inter"], code: ["Consolas"] } });
  });
});

describe("saveFontConfig", () => {
  test("設定ファイルが無ければディレクトリごと作る", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-writer-test-"));
    const configFile = join(dir, "nested", "config.jsonc");

    await saveFontConfig(configFile, { body: ["Inter"], code: [] });

    expect(JSON.parse(await readFile(configFile, "utf-8"))).toEqual({
      font: { body: ["Inter"], code: [] },
    });
  });

  test("書き戻せない形式なら保存せずエラーにする", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-writer-test-"));
    const configFile = join(dir, "config.yaml");
    await writeFile(configFile, "font:\n  body: [Inter]\n");

    await expect(saveFontConfig(configFile, { body: ["Meiryo"], code: [] })).rejects.toThrow(
      "UIから保存できない形式",
    );
    expect(await readFile(configFile, "utf-8")).toContain("Inter");
  });
});
