import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, type MdechoConfig } from "./defaults.ts";
import { applyConfigEdits, isWritableConfigFile, saveConfig } from "./save.ts";

function configOf(overrides: Partial<MdechoConfig>): MdechoConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

const DEFAULT_LINE_BREAK_JSON = { splitSentences: true, singleNewline: true };
const DEFAULT_LAYOUT_JSON = { contentWidth: 1024, fontSize: 16, lineHeight: 1.75 };
// 色(theme.light / theme.dark)はUIから編集しないため書き戻さない。modeだけが出る。
const DEFAULT_THEME_JSON = { mode: "system" };
const DEFAULT_LINK_JSON = { base: "ask" };

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

describe("applyConfigEdits", () => {
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

    const updated = applyConfigEdits(
      source,
      configOf({ font: { body: ["Noto Sans JP"], code: ["Cascadia Code"] } }),
    );

    expect(updated).toContain("// 本文のフォント");
    expect(updated).toContain("/* コードブロック */");
    expect(updated).toContain('"Noto Sans JP"');
    expect(updated).toContain('"Cascadia Code"');
    expect(updated).not.toContain("Inter");
    expect(updated).not.toContain("JetBrains Mono");
  });

  test("lineBreakも書き戻す", () => {
    const source = `{
  // 改行の扱い
  "lineBreak": {
    "splitSentences": true,
    "singleNewline": true,
  },
}
`;

    const updated = applyConfigEdits(
      source,
      configOf({ lineBreak: { splitSentences: false, singleNewline: true } }),
    );

    expect(updated).toContain("// 改行の扱い");
    expect(updated).toContain('"splitSentences": false');
    expect(updated).toContain('"singleNewline": true');
  });

  test("layoutも書き戻す", () => {
    const source = `{
  // 本文の見え方
  "layout": {
    "contentWidth": 1024,
    "fontSize": 16,
    "lineHeight": 1.75,
  },
}
`;

    const updated = applyConfigEdits(
      source,
      configOf({ layout: { contentWidth: 1440, fontSize: 18, lineHeight: 1.9 } }),
    );

    expect(updated).toContain("// 本文の見え方");
    expect(updated).toContain('"contentWidth": 1440');
    expect(updated).toContain('"fontSize": 18');
    expect(updated).toContain('"lineHeight": 1.9');
  });

  test("配色はmodeだけ書き戻し、手書きした色とコメントはそのまま残す", () => {
    const source = `{
  "theme": {
    "mode": "system",
    "dark": {
      // 目に優しい黒
      "base-100": "#000000",
    },
  },
}
`;

    const updated = applyConfigEdits(
      source,
      configOf({ theme: { mode: "dark", light: {}, dark: { "base-100": "#000000" } } }),
    );

    expect(updated).toContain('"mode": "dark"');
    expect(updated).toContain("// 目に優しい黒");
    expect(updated).toContain('"base-100": "#000000"');
  });

  test("mdechoが扱わないキーは残す", () => {
    const updated = applyConfigEdits(
      '{ "future": { "a": 1 } }',
      configOf({ font: { body: ["Inter"], code: [] } }),
    );

    expect(JSON.parse(updated)).toEqual({
      future: { a: 1 },
      font: { body: ["Inter"], code: [] },
      lineBreak: DEFAULT_LINE_BREAK_JSON,
      layout: DEFAULT_LAYOUT_JSON,
      theme: DEFAULT_THEME_JSON,
      link: DEFAULT_LINK_JSON,
    });
  });

  test("空の内容からでも設定を組み立てる", () => {
    const updated = applyConfigEdits(
      "",
      configOf({ font: { body: ["Inter"], code: ["Consolas"] } }),
    );

    expect(JSON.parse(updated)).toEqual({
      font: { body: ["Inter"], code: ["Consolas"] },
      lineBreak: DEFAULT_LINE_BREAK_JSON,
      layout: DEFAULT_LAYOUT_JSON,
      theme: DEFAULT_THEME_JSON,
      link: DEFAULT_LINK_JSON,
    });
  });
});

describe("saveConfig", () => {
  test("設定ファイルが無ければディレクトリごと作る", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-writer-test-"));
    const configFile = join(dir, "nested", "config.jsonc");

    await saveConfig(configFile, configOf({ font: { body: ["Inter"], code: [] } }));

    expect(JSON.parse(await readFile(configFile, "utf-8"))).toEqual({
      font: { body: ["Inter"], code: [] },
      lineBreak: DEFAULT_LINE_BREAK_JSON,
      layout: DEFAULT_LAYOUT_JSON,
      theme: DEFAULT_THEME_JSON,
      link: DEFAULT_LINK_JSON,
    });
  });

  test("書き戻せない形式なら保存せずエラーにする", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-writer-test-"));
    const configFile = join(dir, "config.yaml");
    await writeFile(configFile, "font:\n  body: [Inter]\n");

    await expect(
      saveConfig(configFile, configOf({ font: { body: ["Meiryo"], code: [] } })),
    ).rejects.toThrow("UIから保存できない形式");
    expect(await readFile(configFile, "utf-8")).toContain("Inter");
  });
});
