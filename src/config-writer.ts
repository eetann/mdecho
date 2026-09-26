import { applyEdits, modify } from "jsonc-parser";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { type MdechoConfig, resolveConfigDir } from "./config.ts";

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

/** 既存のJSONCのコメントや整形を保ったまま、UIから編集できる値だけを差し替える。 */
export function applyConfigEdits(source: string, config: MdechoConfig): string {
  let text = source;
  const entries: [path: string[], value: unknown][] = [
    [["font", "body"], config.font.body],
    [["font", "code"], config.font.code],
    [["lineBreak", "splitSentences"], config.lineBreak.splitSentences],
    [["lineBreak", "singleNewline"], config.lineBreak.singleNewline],
    [["layout", "contentWidth"], config.layout.contentWidth],
    [["layout", "fontSize"], config.layout.fontSize],
    [["layout", "lineHeight"], config.layout.lineHeight],
    // 色(theme.light / theme.dark)はUIから編集しないため、ここでは書き戻さない。
    // オブジェクトごと差し替えると、その中に書かれたコメントや並びが消えてしまう。
    [["theme", "mode"], config.theme.mode],
  ];
  for (const [path, value] of entries) {
    text = applyEdits(text, modify(text, path, value, { formattingOptions: FORMATTING_OPTIONS }));
  }
  return text;
}

/** 設定ファイルへ設定を書き込む。ファイルもディレクトリも無ければ作る。 */
export async function saveConfig(configFile: string, config: MdechoConfig): Promise<void> {
  if (!isWritableConfigFile(configFile)) {
    throw new Error(
      `${configFile} はUIから保存できない形式です。JSONCまたはJSONの設定ファイルを使ってください`,
    );
  }
  const source = await readFile(configFile, "utf-8").catch(() => "");
  const updated = applyConfigEdits(source, config);
  await mkdir(dirname(configFile), { recursive: true });
  await writeFile(configFile, updated, "utf-8");
}
