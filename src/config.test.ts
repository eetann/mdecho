import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMdechoConfig, normalizeConfig, resolveConfigDir, resolveLineBreak } from "./config.ts";

let dir: string | undefined;

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

async function writeConfig(fileName: string, content: string): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), "mdecho-config-test-"));
  await writeFile(join(dir, fileName), content);
  return dir;
}

describe("resolveConfigDir", () => {
  test("XDG_CONFIG_HOMEが設定されていればそれを使う", () => {
    expect(resolveConfigDir({ XDG_CONFIG_HOME: "/xdg" })).toBe(join("/xdg", "mdecho"));
  });

  test("XDG_CONFIG_HOMEが未設定なら~/.configを使う", () => {
    const resolved = resolveConfigDir({ HOME: "/home/someone" });
    expect(resolved.endsWith(join(".config", "mdecho"))).toBe(true);
  });

  test("XDG_CONFIG_HOMEが空文字なら~/.configにフォールバックする", () => {
    const resolved = resolveConfigDir({ XDG_CONFIG_HOME: "   " });
    expect(resolved.endsWith(join(".config", "mdecho"))).toBe(true);
  });
});

describe("normalizeConfig", () => {
  test("フォントが1つだけなら文字列でも書ける", () => {
    const config = normalizeConfig({ font: { body: "Inter" } });
    expect(config.font.body).toEqual(["Inter"]);
  });

  test("空文字の要素は取り除く", () => {
    const config = normalizeConfig({ font: { code: ["Fira Code", "  ", ""] } });
    expect(config.font.code).toEqual(["Fira Code"]);
  });

  test("未知のキーを警告する", () => {
    const warnings: string[] = [];
    normalizeConfig({ fonts: { body: ["Inter"] } }, (message) => warnings.push(message));
    expect(warnings).toEqual(["設定に未知のキーがあります: fonts"]);
  });

  test("型が違う設定は警告して無視する", () => {
    const warnings: string[] = [];
    const config = normalizeConfig({ font: { body: 42 } }, (message) => warnings.push(message));
    expect(config.font.body).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  test("設定が無ければ既定値を返す", () => {
    expect(normalizeConfig(undefined).font).toEqual({ body: [], code: [] });
    expect(normalizeConfig(undefined).lineBreak).toEqual({
      splitSentences: true,
      singleNewline: true,
    });
  });

  test("lineBreakは書いた項目だけ上書きされる", () => {
    const config = normalizeConfig({ lineBreak: { splitSentences: false } });
    expect(config.lineBreak).toEqual({ splitSentences: false, singleNewline: true });
  });

  test("fontだけ書いてもlineBreakは既定値になる", () => {
    expect(normalizeConfig({ font: { body: ["Inter"] } }).lineBreak).toEqual({
      splitSentences: true,
      singleNewline: true,
    });
  });

  test("lineBreakに真偽値以外を書くと警告して既定値にする", () => {
    const warnings: string[] = [];
    const config = normalizeConfig({ lineBreak: { singleNewline: "no" } }, (m) => warnings.push(m));
    expect(config.lineBreak.singleNewline).toBe(true);
    expect(warnings).toEqual([
      "lineBreak.singleNewlineはtrueまたはfalseで指定してください。この設定は無視します",
    ]);
  });

  test("lineBreakの未知のキーを警告する", () => {
    const warnings: string[] = [];
    normalizeConfig({ lineBreak: { splitSentence: true } }, (m) => warnings.push(m));
    expect(warnings).toEqual(["lineBreakに未知のキーがあります: splitSentence"]);
  });
});

describe("resolveLineBreak", () => {
  const base = { splitSentences: true, singleNewline: true };

  test("上書きが無ければ設定ファイルの値をそのまま使う", () => {
    expect(resolveLineBreak(base, {})).toEqual(base);
  });

  test("CLIで明示された項目だけ上書きする", () => {
    expect(resolveLineBreak(base, { splitSentences: false })).toEqual({
      splitSentences: false,
      singleNewline: true,
    });
  });

  test("undefinedの項目は上書き扱いしない", () => {
    expect(
      resolveLineBreak(
        { splitSentences: false, singleNewline: false },
        {
          splitSentences: undefined,
          singleNewline: true,
        },
      ),
    ).toEqual({ splitSentences: false, singleNewline: true });
  });
});

describe("loadMdechoConfig", () => {
  test("config.jsoncをコメント付きで読み込める", async () => {
    const cwd = await writeConfig(
      "config.jsonc",
      `{
  // 本文のフォント
  "font": {
    "body": ["Inter", "BIZ UDPGothic"],
    /* コードブロックのフォント */
    "code": ["JetBrains Mono"]
  }
}
`,
    );

    const { config, configFile } = await loadMdechoConfig({ cwd });

    expect(config.font.body).toEqual(["Inter", "BIZ UDPGothic"]);
    expect(config.font.code).toEqual(["JetBrains Mono"]);
    expect(configFile).toContain("config.jsonc");
  });

  test("設定ファイルが無ければ既定値を返す", async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-config-test-"));

    const { config, configFile } = await loadMdechoConfig({ cwd: dir });

    expect(config.font).toEqual({ body: [], code: [] });
    expect(config.lineBreak).toEqual({ splitSentences: true, singleNewline: true });
    expect(configFile).toBeUndefined();
  });

  test("lineBreakを書いた設定ファイルを読み込める", async () => {
    const cwd = await writeConfig(
      "config.jsonc",
      `{
  // 句点で切らずに、行そのままで表示する
  "lineBreak": {
    "splitSentences": false,
    "singleNewline": false,
  },
}
`,
    );
    const warnings: string[] = [];

    const { config } = await loadMdechoConfig({ cwd, warn: (m) => warnings.push(m) });

    expect(config.lineBreak).toEqual({ splitSentences: false, singleNewline: false });
    expect(warnings).toEqual([]);
  });

  test("末尾カンマは構文エラーにしない", async () => {
    const cwd = await writeConfig(
      "config.jsonc",
      '{\n  "font": {\n    "body": ["Inter"],\n  },\n}\n',
    );
    const warnings: string[] = [];

    const { config } = await loadMdechoConfig({ cwd, warn: (m) => warnings.push(m) });

    expect(config.font.body).toEqual(["Inter"]);
    expect(warnings).toEqual([]);
  });

  test("壊れた設定ファイルなら警告して既定値で続行する", async () => {
    const cwd = await writeConfig("config.jsonc", "{ this is not valid");
    const warnings: string[] = [];

    const { config, configFile } = await loadMdechoConfig({ cwd, warn: (m) => warnings.push(m) });

    expect(config.font).toEqual({ body: [], code: [] });
    expect(configFile).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("構文エラー");
  });
});
