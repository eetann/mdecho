import { existsSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { LinkBaseMode } from "../config/defaults.ts";
import type { LinkBase, LinkChoice } from "../markdown/link-choices.ts";

const MARKDOWN_EXTENSION_PATTERN = /\.(?:md|markdown)$/i;

/**
 * 配信範囲の1単位。`-f`のファイルごとに決まり、同じディレクトリになったものは1つにまとめる。
 * 決め方は`createDocSpace`を参照。
 */
export interface DocRoot {
  /** プロジェクトルート。配信してよい範囲の境界で、ルート基準のリンクの起点でもある。 */
  rootDir: string;
  /**
   * このルートを配信するURLの接頭辞。最初の`-f`のファイルのルートは""(URLの`/`がrootDir)で、
   * それ以外は`/~2`のように番号を付ける。
   */
  urlPrefix: string;
}

/** `-f`に渡されたファイル */
export interface EntryFile {
  /** `-f`に渡されたパス(表記はそのまま) */
  filePath: string;
  absPath: string;
  root: DocRoot;
}

/** URLのパスとファイルを対応づけるための基準。`createDocSpace`で作る。 */
export interface DocSpace {
  /** 配信してよい範囲。各エントリのルートの和集合で、エントリの並びで最初に現れた順 */
  roots: DocRoot[];
  /** 指定された順のエントリ(重複は除く)。先頭がURLの`/`に対応する */
  entries: EntryFile[];
}

export interface ResolvedDoc {
  /** 実際に読み込むファイルの絶対パス */
  absPath: string;
  /**
   * URLのパスから先頭の`/`を除いたもの(デコード済み)。最初のルートなら`DocRoot.rootDir`からの
   * 相対パスそのもので、それ以外のルートでは`~2/docs/a.md`のように接頭辞が付く。区切りは常に"/"。
   * ツールバーの表示・コメントの保存キーに使う。
   */
  relPath: string;
  /**
   * `-f`に渡したパスと同じ書き方で表した、このファイルのパス。
   * クリップボードの`path:L9`に載るため、AIエージェントがそのまま開ける形にしておく。
   */
  displayPath: string;
  /** このファイルが属する配信範囲 */
  root: DocRoot;
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

export interface CreateDocSpaceOptions {
  /** プロジェクトルートの探し方。テストで差し替えるためにある */
  findGitRoot?: (startDir: string) => string | undefined;
}

/**
 * `-f`のファイル1つとcwdから、URLの基準になるディレクトリ(プロジェクトルート)を決める。
 *
 * エントリがgitリポジトリの中ならそのルートにする。AIエージェントはリポジトリのルートから
 * 見たパス(`src/foo.ts`など)で書きがちで、どこで起動しても同じ場所を指してほしいため。
 *
 * リポジトリの外なら従来どおりcwdまで広げる(`docs/plan.md`から`../README.md`を開けるように)。
 * ただし`-f /tmp/x.md`のようにcwdの外のファイルを開いたときまで共通の祖先へ広げると、
 * `/`やホームディレクトリ全体を配信しかねないので、その場合はエントリのディレクトリに留める。
 */
function findRootDir(
  entryAbsPath: string,
  cwdAbs: string,
  findRoot: (startDir: string) => string | undefined,
): string {
  const entryDir = dirname(entryAbsPath);
  return findRoot(entryDir) ?? (isWithinDir(cwdAbs, entryDir) ? cwdAbs : entryDir);
}

/**
 * `-f`のファイル(複数可)とcwdから、配信範囲とURLの対応を決める。
 *
 * ファイルごとに`findRootDir`でルートを決め、その和集合を配信範囲にする。
 * バラバラの場所にあるファイルを渡されたときに共通の祖先を配信範囲にすると、
 * 最悪ホームディレクトリ全体が見えてしまうため、ルートどうしを1つへまとめることはしない。
 * 2つ目以降のルートは`/~2`のような接頭辞の下で配信する。
 */
export function createDocSpace(
  entryFilePaths: string[],
  cwd: string = process.cwd(),
  options: CreateDocSpaceOptions = {},
): DocSpace {
  const cwdAbs = resolve(cwd);
  const findRoot = options.findGitRoot ?? findGitRoot;
  const roots: DocRoot[] = [];
  const entries: EntryFile[] = [];
  for (const filePath of entryFilePaths) {
    const absPath = resolve(cwdAbs, filePath);
    if (entries.some((entry) => entry.absPath === absPath)) continue;
    const rootDir = findRootDir(absPath, cwdAbs, findRoot);
    let root = roots.find((r) => r.rootDir === rootDir);
    if (!root) {
      root = { rootDir, urlPrefix: roots.length === 0 ? "" : `/~${roots.length + 1}` };
      roots.push(root);
    }
    entries.push({ filePath, absPath, root });
  }
  return { roots, entries };
}

/** rootDir配下の絶対パスを、そのファイルを指すURLのパスへ変換する */
export function toUrlPath(root: DocRoot, absPath: string): string {
  const encoded = relative(root.rootDir, absPath).split(sep).map(encodeURIComponent).join("/");
  return `${root.urlPrefix}/${encoded}`;
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

/** デコード済みのURLのパスが、どのルートのどのパスを指しているか */
function findRootOf(space: DocSpace, decoded: string): { root: DocRoot; rest: string } | undefined {
  // 接頭辞の無い最初のルートは何にでも当てはまるため、接頭辞付きのルートを先に見る。
  for (const root of space.roots) {
    if (root.urlPrefix === "") continue;
    if (decoded === root.urlPrefix || decoded.startsWith(`${root.urlPrefix}/`)) {
      return { root, rest: decoded.slice(root.urlPrefix.length) };
    }
  }
  const [first] = space.roots;
  return first?.urlPrefix === "" ? { root: first, rest: decoded } : undefined;
}

/**
 * `-f`に渡したパスと同じ書き方で、absPathを表す。
 * エントリ自身は渡された表記をそのまま保ち(`./doc.md`の`./`を落とさない)、
 * それ以外は同じルートの最初のエントリからの相対で表す。
 */
function toDisplayPath(space: DocSpace, root: DocRoot, absPath: string): string {
  const self = space.entries.find((entry) => entry.absPath === absPath);
  if (self) {
    return self.filePath;
  }
  const base = space.entries.find((entry) => entry.root === root);
  if (!base) {
    return absPath;
  }
  return join(dirname(base.filePath), relative(dirname(base.absPath), absPath));
}

/**
 * リクエストされたURLのパスを、配信範囲のファイルへ解決する。
 * その外(`../`など)を指すパスと、デコードできないパスはundefinedを返す。
 * `/`は最初のエントリのファイルを指す。
 *
 * urlPathはHonoの`c.req.path`と同じくパーセントエンコードされたままの想定で、ここでデコードする。
 */
export function resolveDoc(space: DocSpace, urlPath: string): ResolvedDoc | undefined {
  const decoded = decodePath(urlPath);
  if (decoded === undefined) {
    return undefined;
  }

  let root: DocRoot;
  let absPath: string;
  const [firstEntry] = space.entries;
  if (decoded === "/" && firstEntry) {
    root = firstEntry.root;
    absPath = firstEntry.absPath;
  } else {
    const found = findRootOf(space, decoded);
    if (!found) {
      return undefined;
    }
    root = found.root;
    const requested = found.rest.replace(/^\/+/, "");
    if (requested === "") {
      return undefined;
    }
    absPath = resolve(root.rootDir, `./${requested}`);
    if (!isWithinDir(root.rootDir, absPath)) {
      return undefined;
    }
  }

  // `a/../b.md`のような表記を正規化するため、URLではなく解決後の絶対パスから組み立て直す。
  const prefix = root.urlPrefix === "" ? "" : `${root.urlPrefix.slice(1)}/`;
  return {
    absPath,
    relPath: `${prefix}${relative(root.rootDir, absPath).split(sep).join("/")}`,
    displayPath: toDisplayPath(space, root, absPath),
    root,
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
 * 先頭が`/`のパスはプロジェクトルート基準として扱う。URLの`/`がrootDirに対応している
 * 最初のルートでは書き換えずにundefinedを返し、接頭辞の付くルートでは接頭辞を足す。
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

  if (decoded.startsWith("/")) {
    if (root.urlPrefix === "") {
      return undefined;
    }
    const absPath = resolve(root.rootDir, `.${decoded}`);
    return isWithinDir(root.rootDir, absPath) ? { url: toUrlPath(root, absPath) } : undefined;
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
    url: toUrlPath(root, absPath),
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
