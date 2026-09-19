import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isWsl } from "./platform.ts";

const execFileAsync = promisify(execFile);

export interface SystemFont {
  /** 設定ファイルに書く名前 */
  name: string;
  /** 同じフォントを指す別名(日本語名など)。nameと同じものは含まない */
  aliases: string[];
}

/**
 * WPFのSystemFontFamiliesを使う。System.Drawingだとフォント名が31文字で切れるうえ、
 * ロケール依存の名前しか取れないため使わない。Sourceは英語名、FamilyNamesは全ロケールの名前。
 */
const POWERSHELL_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName PresentationCore
[Windows.Media.Fonts]::SystemFontFamilies | ForEach-Object {
  $primary = $_.Source
  $aliases = @($_.FamilyNames.Values) | Where-Object { $_ -ne $primary }
  (@($primary) + $aliases) -join "\`t"
}
`;

interface MutableFont {
  name: string;
  aliases: Set<string>;
}

/** 同じフォントを指す名前のまとまりを、重複を除いてSystemFontの配列へまとめる。 */
function collectFonts(nameGroups: string[][]): SystemFont[] {
  const entriesByName = new Map<string, MutableFont>();
  const entries = new Set<MutableFont>();

  for (const group of nameGroups) {
    const names = group.map((name) => name.trim()).filter((name) => name.length > 0);
    const primary = names[0];
    if (primary === undefined) {
      continue;
    }

    // 同じフォントが別の順序で複数回現れることがある(fc-listはフェイスごとに1行出す)ため、
    // 既に見たことのある名前を含むまとまりは、その既存エントリへ別名として合流させる。
    const existing = names.map((name) => entriesByName.get(name)).find((e) => e !== undefined);
    const entry = existing ?? { name: primary, aliases: new Set<string>() };
    if (!existing) {
      entries.add(entry);
    }
    for (const name of names) {
      entry.aliases.add(name);
      entriesByName.set(name, entry);
    }
    entry.aliases.delete(entry.name);
  }

  return [...entries]
    .map((entry) => ({ name: entry.name, aliases: [...entry.aliases].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parsePowerShellFonts(stdout: string): SystemFont[] {
  return collectFonts(stdout.split(/\r?\n/).map((line) => line.split("\t")));
}

export function parseFcListFonts(stdout: string): SystemFont[] {
  return collectFonts(stdout.split(/\r?\n/).map((line) => line.split(",")));
}

/** macOSの`system_profiler -json SPFontsDataType`の出力からファミリー名を拾う。 */
export function parseSystemProfilerFonts(stdout: string): SystemFont[] {
  const parsed: unknown = JSON.parse(stdout);
  const fonts = (parsed as { SPFontsDataType?: unknown }).SPFontsDataType;
  if (!Array.isArray(fonts)) {
    throw new Error("system_profilerの出力にSPFontsDataTypeがありません");
  }

  const families: string[] = [];
  for (const font of fonts) {
    const typefaces = (font as { typefaces?: unknown }).typefaces;
    if (!Array.isArray(typefaces)) {
      continue;
    }
    for (const typeface of typefaces) {
      const family = (typeface as { family?: unknown }).family;
      if (typeof family === "string") {
        families.push(family);
      }
    }
  }
  return collectFonts(families.map((family) => [family]));
}

/** フォントが多い環境では出力がexecFileの既定(1MB)を超えるため、余裕を持たせる。 */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

interface FontSource {
  /** 見つからなかったときのメッセージに使うコマンド名 */
  command: string;
  /** コマンドが見つからなかったときの案内 */
  notFoundHint: string;
  run: () => Promise<SystemFont[]>;
}

function resolveFontSource(): FontSource {
  // WSLではWindows側のブラウザで描画される(open-browser.ts)ため、
  // Linux側ではなくWindowsのフォントを一覧する。
  if (process.platform === "win32" || isWsl()) {
    return {
      command: "powershell.exe",
      notFoundHint: "PowerShellを実行できる環境か確認してください",
      run: async () => {
        // 引用符のエスケープを考えずに済むよう、スクリプトはUTF-16LEのbase64で渡す。
        const encoded = Buffer.from(POWERSHELL_SCRIPT, "utf16le").toString("base64");
        const { stdout } = await execFileAsync("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          encoded,
        ]);
        return parsePowerShellFonts(stdout);
      },
    };
  }

  if (process.platform === "darwin") {
    return {
      command: "system_profiler",
      notFoundHint: "macOS標準のsystem_profilerが見つかりません",
      run: async () => {
        const { stdout } = await execFileAsync("system_profiler", ["-json", "SPFontsDataType"], {
          maxBuffer: MAX_OUTPUT_BYTES,
        });
        return parseSystemProfilerFonts(stdout);
      },
    };
  }

  return {
    command: "fc-list",
    notFoundHint: "fontconfig(fc-listコマンド)をインストールしてください",
    run: async () => {
      const { stdout } = await execFileAsync("fc-list", [":", "family"], {
        maxBuffer: MAX_OUTPUT_BYTES,
      });
      return parseFcListFonts(stdout);
    },
  };
}

/** 実行中のシステムでブラウザが使えるフォントの一覧を取得する。 */
export async function listSystemFonts(): Promise<SystemFont[]> {
  const source = resolveFontSource();
  try {
    return await source.run();
  } catch (error) {
    if ((error as { code?: unknown }).code === "ENOENT") {
      throw new Error(
        `フォント一覧の取得に必要な ${source.command} が見つかりません。${source.notFoundHint}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`フォント一覧の取得に失敗しました (${source.command}): ${message}`);
  }
}
