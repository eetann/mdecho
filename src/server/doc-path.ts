import { existsSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { LinkBaseMode } from "../config/defaults.ts";
import type { LinkBase, LinkChoice } from "../markdown/link-choices.ts";

const MARKDOWN_EXTENSION_PATTERN = /\.(?:md|markdown)$/i;

/** URLのパスとファイルを対応づけるための基準。`createDocRoot`で作る。 */
export interface DocRoot {
  /**
   * プロジェクトルート。URLの`/`に対応するディレクトリで、配信してよい範囲の境界でもあり、
   * ルート基準のリンクの起点でもある。決め方は`createDocRoot`を参照。
   */
  rootDir: string;
  /** `-f`に渡されたパス(表記はそのまま) */
  entryFilePath: string;
  /** エントリのファイルの絶対パス */
  entryAbsPath: string;
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
 * startDirから上へ辿って、最初に`.git`(worktreeやsubmoduleではファイル)があるディレクトリを返す。
 * 無ければundefined。
 *
 * ホームディレクトリそのものがリポジトリ(dotfilesの管理)の場合は、プロジェクトとはみなさない。
 * そこを基準にするとホームディレクトリ全体を配信してしまうため。
 */
export function findGitRoot(startDir: string, home: string = homedir()): string | undefined {
  let dir = resolve(startDir);
  const homeAbs = resolve(home);
  while (true) {
    if (dir !== homeAbs && existsSync(join(dir, ".git"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

export interface CreateDocRootOptions {
  /** プロジェクトルートの探し方。テストで差し替えるためにある */
  findGitRoot?: (startDir: string) => string | undefined;
}

/**
 * `-f`のファイルとcwdから、URLの基準になるディレクトリ(プロジェクトルート)を決める。
 *
 * エントリがgitリポジトリの中ならそのルートにする。AIエージェントはリポジトリのルートから
 * 見たパス(`src/foo.ts`など)で書きがちで、どこで起動しても同じ場所を指してほしいため。
 *
 * リポジトリの外なら従来どおりcwdまで広げる(`docs/plan.md`から`../README.md`を開けるように)。
 * ただし`-f /tmp/x.md`のようにcwdの外のファイルを開いたときまで共通の祖先へ広げると、
 * `/`やホームディレクトリ全体を配信しかねないので、その場合はエントリのディレクトリに留める。
 */
export function createDocRoot(
  entryFilePath: string,
  cwd: string = process.cwd(),
  options: CreateDocRootOptions = {},
): DocRoot {
  const cwdAbs = resolve(cwd);
  const entryAbsPath = resolve(cwdAbs, entryFilePath);
  const entryDir = dirname(entryAbsPath);
  const gitRoot = (options.findGitRoot ?? findGitRoot)(entryDir);
  return {
    rootDir: gitRoot ?? (isWithinDir(cwdAbs, entryDir) ? cwdAbs : entryDir),
    entryFilePath,
    entryAbsPath,
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

export interface ResolveLinkUrlOptions {
  /** 設定の`link.base` */
  mode: LinkBaseMode;
  /** `<a href>`か`<img src>`か。画像はクリックで選ばせられないため、askでも1つに決める */
  kind: "link" | "image";
}

export interface ResolvedLinkUrl {
  /** 書き換え後のURLのパス */
  url: string;
  /**
   * askのリンクで、ファイル基準とルート基準の両方に実在したときだけ付く選択肢。
   * 並びは優先順で、先頭はurlと同じ(新しいタブで開いたときなどはそちらへ行く)。
   */
  choices?: LinkChoice[];
}

/**
 * Markdown中の相対リンク・画像のパスを、rootDirからの絶対URLのパスへ解決する。
 *
 * 基準の候補は、そのMarkdownファイルのあるディレクトリ(CommonMarkやGitHubと同じ)と
 * プロジェクトルート(`DocRoot.rootDir`)の2つ。リポジトリによってどちらで書かれているかが
 * 違うため、どう扱うかは`mode`で決める。
 * - file / root: その基準だけで解決する
 * - ask: 実在する方へ解決する。リンクで両方に実在すれば`choices`を付けて選ばせ、
 *   画像はルート基準を優先する。どちらにも無ければ優先する側のURLを返す(開けば404ページになる)
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
  options: ResolveLinkUrlOptions,
): Promise<ResolvedLinkUrl | undefined> {
  const decoded = decodePath(linkPath);
  if (decoded === undefined || decoded === "") {
    return undefined;
  }

  const byBase: Record<LinkBase, string> = {
    file: resolve(dirname(docAbsPath), decoded),
    root: resolve(root.rootDir, decoded),
  };
  const order: LinkBase[] =
    options.mode !== "ask"
      ? [options.mode]
      : options.kind === "image"
        ? ["root", "file"]
        : ["file", "root"];
  const candidates = order
    .map((base) => ({ base, absPath: byBase[base] }))
    .filter(({ absPath }) => isWithinDir(root.rootDir, absPath))
    // ルート直下のMarkdownでは2つの基準が同じ場所を指すため、1つにまとめる。
    .filter(({ absPath }, index, list) => list.findIndex((c) => c.absPath === absPath) === index);
  const [fallback] = candidates;
  if (fallback === undefined) {
    return undefined;
  }

  const existing = (
    await Promise.all(
      candidates.map(async (candidate) => ((await exists(candidate.absPath)) ? candidate : null)),
    )
  ).filter((candidate) => candidate !== null);
  const toChoice = ({ base, absPath }: (typeof candidates)[number]): LinkChoice => ({
    base,
    url: toUrlPath(root.rootDir, absPath),
  });

  const [first] = existing;
  if (first === undefined) {
    return { url: toChoice(fallback).url };
  }
  if (options.kind === "link" && existing.length >= 2) {
    return { url: toChoice(first).url, choices: existing.map(toChoice) };
  }
  return { url: toChoice(first).url };
}
