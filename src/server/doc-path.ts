import { realpath, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const MARKDOWN_EXTENSION_PATTERN = /\.(?:md|markdown)$/i;

/** URLのパスとファイルを対応づけるための基準。`createDocRoot`で作る。 */
export interface DocRoot {
  /**
   * URLの`/`に対応するディレクトリで、配信してよい範囲の境界でもある。
   * エントリのファイルがcwdの配下ならcwd、そうでなければエントリのあるディレクトリ。
   */
  rootDir: string;
  /** `-f`に渡されたパス(表記はそのまま) */
  entryFilePath: string;
  /** エントリのファイルの絶対パス */
  entryAbsPath: string;
  /** コマンドを実行したディレクトリの絶対パス。リンクの解決でMarkdownファイル基準の次に使う */
  cwd: string;
}

export interface ResolvedDoc {
  /** 実際に読み込むファイルの絶対パス */
  absPath: string;
  /**
   * `DocRoot.rootDir`を起点にした相対パス。区切りは常に"/"。
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
 * absPathがbaseDirそのものか、その配下にあるか。どちらも解決済みの絶対パスであること。
 * baseDirがルートディレクトリのときは末尾が既に区切り文字なので、二重に足さない。
 */
export function isWithinDir(baseDir: string, absPath: string): boolean {
  if (absPath === baseDir) {
    return true;
  }
  const prefix = baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`;
  return absPath.startsWith(prefix);
}

/**
 * symlinkを辿った先もbaseDir配下かを確かめる。実体を解決できないパスはfalse。
 *
 * `resolveDoc`の境界チェックはパスの表記だけを見るため、ディレクトリの中に置かれた
 * 「外を指すsymlink」はそのまま通り抜ける(`sub/link.md -> /etc/passwd`が読めてしまう)。
 * ファイルを実際に読む直前に、この関数で実体のパスを確かめ直すこと。
 */
export async function isRealPathWithinDir(baseDir: string, absPath: string): Promise<boolean> {
  const [realBaseDir, realAbsPath] = await Promise.all([
    realpath(baseDir).catch(() => undefined),
    realpath(absPath).catch(() => undefined),
  ]);
  if (realBaseDir === undefined || realAbsPath === undefined) {
    return false;
  }
  // baseDir自体がsymlink経由で辿られていることもあるため、両方を実体に揃えてから比べる。
  return isWithinDir(realBaseDir, realAbsPath);
}

/**
 * `-f`のファイルとcwdから、URLの基準になるディレクトリを決める。
 *
 * エントリのディレクトリをそのまま基準にすると、`docs/plan.md`から`../README.md`への
 * リンクが範囲外になって開けない。そこでcwdまで広げる。ただし`-f /tmp/x.md`のように
 * cwdの外のファイルを開いたときまで共通の祖先へ広げると、`/`やホームディレクトリ全体を
 * 配信しかねないので、その場合はエントリのディレクトリに留める。
 */
export function createDocRoot(entryFilePath: string, cwd: string = process.cwd()): DocRoot {
  const cwdAbs = resolve(cwd);
  const entryAbsPath = resolve(cwdAbs, entryFilePath);
  const entryDir = dirname(entryAbsPath);
  return {
    rootDir: isWithinDir(cwdAbs, entryDir) ? cwdAbs : entryDir,
    entryFilePath,
    entryAbsPath,
    cwd: cwdAbs,
  };
}

/** rootDir配下の絶対パスを、そのファイルを指すURLのパスへ変換する */
function toUrlPath(rootDir: string, absPath: string): string {
  return `/${relative(rootDir, absPath).split(sep).map(encodeURIComponent).join("/")}`;
}

/** パーセントエンコードされたパスをデコードする。デコードできないものとヌル文字入りはundefined */
function decodePath(path: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  // ヌル文字入りのパスはnode:fsが例外を投げるため、解決の時点で弾く。
  return decoded.includes("\0") ? undefined : decoded;
}

/**
 * リクエストされたURLのパスを、`DocRoot.rootDir`配下のファイルへ解決する。
 * その外(`../`など)を指すパスと、デコードできないパスはundefinedを返す。
 * `/`はエントリのファイルを指す。
 *
 * urlPathはHonoの`c.req.path`と同じくパーセントエンコードされたままの想定で、ここでデコードする。
 */
export function resolveDoc(root: DocRoot, urlPath: string): ResolvedDoc | undefined {
  const { rootDir, entryFilePath, entryAbsPath } = root;
  const decoded = decodePath(urlPath);
  if (decoded === undefined) {
    return undefined;
  }

  let absPath = entryAbsPath;
  if (decoded !== "/") {
    const requested = decoded.replace(/^\/+/, "");
    if (requested === "") {
      return undefined;
    }
    absPath = resolve(rootDir, `./${requested}`);
    if (!isWithinDir(rootDir, absPath)) {
      return undefined;
    }
  }

  // `a/../b.md`のような表記を正規化するため、URLではなく解決後の絶対パスから組み立て直す。
  return {
    absPath,
    relPath: relative(rootDir, absPath).split(sep).join("/"),
    // エントリ自身は`-f`に渡された表記をそのまま保つ(`./doc.md`の`./`を落とさない)。
    displayPath:
      absPath === entryAbsPath
        ? entryFilePath
        : join(dirname(entryFilePath), relative(dirname(entryAbsPath), absPath)),
  };
}

async function exists(absPath: string): Promise<boolean> {
  return (await stat(absPath).catch(() => undefined)) !== undefined;
}

/**
 * Markdown中の相対リンク・画像のパスを、rootDirからの絶対URLのパスへ解決する。
 *
 * まずそのMarkdownファイルのあるディレクトリを基準に探し(CommonMarkやGitHubと同じ)、
 * 無ければcwdを基準に探す。AIエージェントはリポジトリのルートから見たパス
 * (`src/foo.ts`など)で書きがちなので、深い場所のMarkdownからでもそれを拾えるようにする。
 * どちらにも無ければMarkdownファイル基準のURLを返す(開けば404ページになる)。
 *
 * ページのURLに任せず絶対URLにしておくのは、エントリを`/`で配信しているため。
 * `docs/plan.md`を`-f`したとき、`./a.png`をブラウザに解決させると`/a.png`になってしまう。
 *
 * linkPathには`?`や`#`より前の、パーセントエンコードされたままのパスを渡すこと。
 * rootDirの外を指すもの・デコードできないものはundefinedを返す。
 */
export async function resolveLinkUrl(
  root: DocRoot,
  docAbsPath: string,
  linkPath: string,
): Promise<string | undefined> {
  const decoded = decodePath(linkPath);
  if (decoded === undefined || decoded === "") {
    return undefined;
  }

  const candidates = [resolve(dirname(docAbsPath), decoded), resolve(root.cwd, decoded)].filter(
    (absPath) => isWithinDir(root.rootDir, absPath),
  );
  for (const absPath of candidates) {
    if (await exists(absPath)) {
      return toUrlPath(root.rootDir, absPath);
    }
  }
  const [fallback] = candidates;
  return fallback === undefined ? undefined : toUrlPath(root.rootDir, fallback);
}
