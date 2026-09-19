import { loadConfig } from "c12";
import { parseJSONC } from "confbox/jsonc";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { type FontFamilies, toFontFamilyToken } from "./font-css.ts";

export interface MdechoConfig {
  font: FontFamilies;
}

const KNOWN_TOP_LEVEL_KEYS = new Set(["font"]);
const KNOWN_FONT_KEYS = new Set(["body", "code"]);

export const DEFAULT_CONFIG: MdechoConfig = { font: { body: [], code: [] } };

export type WarnFn = (message: string) => void;

const defaultWarn: WarnFn = (message) => {
  console.error(`[mdecho] ${message}`);
};

/**
 * 設定ファイルを置くディレクトリ。XDG Base Directoryに従い、
 * $XDG_CONFIG_HOME/mdecho (未設定なら ~/.config/mdecho) を使う。
 */
export function resolveConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const xdgConfigHome = env.XDG_CONFIG_HOME?.trim();
  const base =
    xdgConfigHome && xdgConfigHome.length > 0 ? xdgConfigHome : join(homedir(), ".config");
  return join(base, "mdecho");
}

function normalizeFontList(value: unknown, keyPath: string, warn: WarnFn): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  // フォントが1つだけのときは文字列でも書けるようにする。
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list)) {
    warn(`${keyPath}は文字列または文字列の配列で指定してください。この設定は無視します`);
    return [];
  }

  const fonts: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") {
      warn(
        `${keyPath}に文字列以外の値が含まれています。この要素は無視します: ${JSON.stringify(item)}`,
      );
      continue;
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      continue;
    }
    // 黙って無視されると原因が分からないため、CSSに書けない名前はここで弾いて知らせる。
    // (`mdecho font-ls`の出力を括弧ごと貼り付けた場合などに起きる)
    if (toFontFamilyToken(trimmed) === undefined) {
      warn(
        `${keyPath}にフォント名として使えない文字が含まれています。この要素は無視します: ${JSON.stringify(trimmed)}`,
      );
      continue;
    }
    fonts.push(trimmed);
  }
  return fonts;
}

function warnUnknownKeys(value: object, known: Set<string>, keyPath: string, warn: WarnFn): void {
  for (const key of Object.keys(value)) {
    // c12の$env/$meta等のメタキーは設定ファイル側の正当な記法なので対象外。
    if (key.startsWith("$") || key === "extends" || known.has(key)) {
      continue;
    }
    warn(`${keyPath}に未知のキーがあります: ${key}`);
  }
}

/** 設定ファイルから読んだ生の値を検証し、扱いやすい形へ正規化する。 */
export function normalizeConfig(raw: unknown, warn: WarnFn = defaultWarn): MdechoConfig {
  if (raw === undefined || raw === null) {
    return DEFAULT_CONFIG;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    warn("設定ファイルのトップレベルはオブジェクトである必要があります。設定を無視します");
    return DEFAULT_CONFIG;
  }
  warnUnknownKeys(raw, KNOWN_TOP_LEVEL_KEYS, "設定", warn);

  const rawFont = (raw as { font?: unknown }).font;
  if (rawFont === undefined || rawFont === null) {
    return DEFAULT_CONFIG;
  }
  if (typeof rawFont !== "object" || Array.isArray(rawFont)) {
    warn("fontはオブジェクトで指定してください。この設定は無視します");
    return DEFAULT_CONFIG;
  }
  warnUnknownKeys(rawFont, KNOWN_FONT_KEYS, "font", warn);

  return {
    font: {
      body: normalizeFontList((rawFont as { body?: unknown }).body, "font.body", warn),
      code: normalizeFontList((rawFont as { code?: unknown }).code, "font.code", warn),
    },
  };
}

const JSONC_EXTENSIONS = new Set([".json", ".jsonc"]);

/**
 * c12が使うJSONCパーサーは壊れた入力でも例外を投げず、読めたところまでを返す。
 * そのままだと設定ファイルのタイポに気づけないため、厳密にパースし直して検査する。
 */
async function findJsoncSyntaxError(configFile: string): Promise<string | undefined> {
  if (!JSONC_EXTENSIONS.has(extname(configFile))) {
    return undefined;
  }
  let source: string;
  try {
    source = await readFile(configFile, "utf-8");
  } catch {
    return undefined;
  }
  if (source.trim().length === 0) {
    return undefined;
  }
  try {
    parseJSONC(source, { allowTrailingComma: true });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export interface LoadedConfig {
  config: MdechoConfig;
  /** 実際に読み込めた設定ファイルのパス。見つからなければundefined */
  configFile: string | undefined;
}

export interface LoadMdechoConfigOptions {
  /** 設定ファイルを探すディレクトリ(既定: resolveConfigDir()) */
  cwd?: string;
  warn?: WarnFn;
}

/**
 * ~/.config/mdecho/config.jsonc (JSON/JSON5/YAML/TOML/JS/TSも可)を読み込む。
 * Markdownの表示自体は設定なしでも成立するため、読み込みに失敗しても
 * 警告を出して既定値で続行する。
 */
export async function loadMdechoConfig(
  options: LoadMdechoConfigOptions = {},
): Promise<LoadedConfig> {
  const { cwd = resolveConfigDir(), warn = defaultWarn } = options;

  try {
    const loaded = await loadConfig<Record<string, unknown>>({
      cwd,
      name: "mdecho",
      configFile: "config",
      // プロジェクト用ではなくグローバル設定なので、rcファイルやpackage.jsonは見ない。
      rcFile: false,
      globalRc: false,
      packageJson: false,
      dotenv: false,
      envName: false,
    });
    const configFile = loaded._configFile;
    if (configFile === undefined) {
      return { config: DEFAULT_CONFIG, configFile: undefined };
    }

    const syntaxError = await findJsoncSyntaxError(configFile);
    if (syntaxError !== undefined) {
      warn(
        `設定ファイルに構文エラーがあるため、既定の設定で起動します (${configFile}): ${syntaxError}`,
      );
      return { config: DEFAULT_CONFIG, configFile: undefined };
    }

    return { config: normalizeConfig(loaded.config, warn), configFile };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warn(`設定ファイルの読み込みに失敗したため、既定の設定で起動します: ${message}`);
    return { config: DEFAULT_CONFIG, configFile: undefined };
  }
}
