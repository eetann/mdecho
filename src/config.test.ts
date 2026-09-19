import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMdechoConfig, normalizeConfig, resolveConfigDir } from "./config.ts";

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
    expect(configFile).toBeUndefined();
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
