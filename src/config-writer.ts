import { applyEdits, modify } from "jsonc-parser";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { resolveConfigDir } from "./config.ts";
import type { FontFamilies } from "./font-css.ts";

/** UIから書き換えられる設定ファイルの拡張子。 */
const WRITABLE_EXTENSIONS = new Set([".json", ".jsonc"]);

const FORMATTING_OPTIONS = { insertSpaces: true, tabSize: 2, eol: "\n" };

/** 設定ファイルがまだ無いときに新しく作る場所。 */
export function defaultConfigFile(): string {
  return join(resolveConfigDir(), "config.jsonc");
}

/**
 * YAMLやTypeScriptの設定ファイルを使っている場合、JSONCとして書き戻すと壊れるため、
 * UIからの保存を許さない。
 */
export function isWritableConfigFile(configFile: string): boolean {
  return WRITABLE_EXTENSIONS.has(extname(configFile));
}

/** 既存のJSONCのコメントや整形を保ったまま、fontの値だけを差し替える。 */
export function applyFontEdits(source: string, fonts: FontFamilies): string {
  let text = source;
  for (const key of ["body", "code"] as const) {
    const edits = modify(text, ["font", key], fonts[key], {
      formattingOptions: FORMATTING_OPTIONS,
    });
    text = applyEdits(text, edits);
  }
  return text;
}

/** 設定ファイルへfontの設定を書き込む。ファイルもディレクトリも無ければ作る。 */
export async function saveFontConfig(configFile: string, fonts: FontFamilies): Promise<void> {
  if (!isWritableConfigFile(configFile)) {
    throw new Error(
      `${configFile} はUIから保存できない形式です。JSONCまたはJSONの設定ファイルを使ってください`,
    );
  }
  const source = await readFile(configFile, "utf-8").catch(() => "");
  const updated = applyFontEdits(source, fonts);
  await mkdir(dirname(configFile), { recursive: true });
  await writeFile(configFile, updated, "utf-8");
}
