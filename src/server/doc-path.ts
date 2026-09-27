import { basename, dirname, join, relative, resolve, sep } from "node:path";

const MARKDOWN_EXTENSION_PATTERN = /\.(?:md|markdown)$/i;

export interface ResolvedDoc {
  /** 実際に読み込むファイルの絶対パス */
  absPath: string;
  /**
   * Markdownのあるディレクトリを起点にした相対パス。区切りは常に"/"。
   * URL・ツールバーの表示・コメントの保存キーに使う。
   */
  relPath: string;
  /**
   * `-f`に渡したパスと同じ書き方で表した、このファイルのパス。
   * クリップボードの`path:L9`に載るため、AIエージェントがそのまま開ける形にしておく。
   */
  displayPath: string;
}

/** `./foo.md`のようなリンク先をmdechoがレンダリングする対象とみなすか */
export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSION_PATTERN.test(path);
}

/**
 * リクエストされたURLのパスを、`-f`で指定したファイルのあるディレクトリ配下のファイルへ解決する。
 * そのディレクトリの外(`../`など)を指すパスと、デコードできないパスはundefinedを返す。
 *
 * urlPathはHonoの`c.req.path`と同じくパーセントエンコードされたままの想定で、ここでデコードする。
 */
export function resolveDoc(entryFilePath: string, urlPath: string): ResolvedDoc | undefined {
  const baseDir = dirname(resolve(entryFilePath));
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }
  // ヌル文字入りのパスはnode:fsが例外を投げるため、解決の時点で弾く。
  if (decoded.includes("\0")) {
    return undefined;
  }

  const requested = decoded === "/" ? basename(entryFilePath) : decoded.replace(/^\/+/, "");
  if (requested === "") {
    return undefined;
  }

  const absPath = resolve(baseDir, `./${requested}`);
  // baseDirがルートディレクトリのときは末尾が既に区切り文字なので、二重に足さない。
  const prefix = baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`;
  if (absPath !== baseDir && !absPath.startsWith(prefix)) {
    return undefined;
  }

  // `a/../b.md`のような表記を正規化するため、URLではなく解決後の絶対パスから組み立て直す。
  const nativeRelPath = relative(baseDir, absPath);
  return {
    absPath,
    relPath: nativeRelPath.split(sep).join("/"),
    // エントリ自身は`-f`に渡された表記をそのまま保つ(`./doc.md`の`./`を落とさない)。
    displayPath:
      absPath === resolve(entryFilePath)
        ? entryFilePath
        : join(dirname(entryFilePath), nativeRelPath),
  };
}
