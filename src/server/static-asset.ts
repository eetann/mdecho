import { realpath, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { isRealPathWithinDir, resolveDoc } from "./doc-path.ts";

/**
 * 静的配信する拡張子。Markdownから相対パスで読み込めるのは画像だけなので画像に絞る
 * (生HTMLはレンダリング時に落としているため`<video>`や`<link rel="stylesheet">`は書けない)。
 *
 * 絞らないと`-f`したファイルと同じディレクトリ配下が拡張子もdotfileも問わず全部
 * localhostに出てしまう。リポジトリのルートで`mdecho -f ./README.md`を実行すると
 * `.env`や`.git/config`まで読める、という状態だった。
 */
const SERVABLE_ASSET_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

/**
 * 静的配信のレスポンスに付けるヘッダ。
 *
 * SVGは`<img>`から読む分にはスクリプトが走らないが、`[link](./foo.svg)`のように
 * 直接開かれるとmdechoのoriginでスクリプトが走る。`sandbox`を付けると一意なoriginへ
 * 隔離されるため、直接開かれてもmdechoのページには触れなくなる。
 * このCSPは画像として読み込むときには効かない(CSPが効くのは文書とワーカーだけ)ので、
 * Markdown中の`![alt](./foo.svg)`はそのまま表示される。
 */
export const STATIC_ASSET_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
};

/** 静的配信の対象とみなす拡張子か */
export function isServableAssetPath(path: string): boolean {
  return SERVABLE_ASSET_EXTENSIONS.has(extname(path).toLowerCase());
}

/**
 * リクエストされたURLのパスを、静的配信してよいファイルの実体パスへ解決する。
 * 配信してはいけないものはundefinedを返す。
 *
 * `resolveDoc`の境界チェックは`../`・`%2e%2e`・ヌル文字入りのパスまで弾けるが、
 * symlinkだけは通り抜ける(`serveStatic`が辿るため`sub/link -> /etc/passwd`が読めてしまう)。
 * そこで`realpath`で実体まで解決し直してから、もう一度ディレクトリの内側かを確かめる。
 */
export async function resolveServableAsset(
  entryFilePath: string,
  urlPath: string,
): Promise<string | undefined> {
  const doc = resolveDoc(entryFilePath, urlPath);
  if (!doc || !isServableAssetPath(doc.relPath)) {
    return undefined;
  }

  // symlinkは`serveStatic`が辿るため、`resolveDoc`の境界チェックだけでは
  // ディレクトリ外のファイル(`sub/link.png -> /etc/passwd`)まで読めてしまう。
  const baseDir = dirname(resolve(entryFilePath));
  if (!(await isRealPathWithinDir(baseDir, doc.absPath))) {
    return undefined;
  }

  // `foo.png`という名前のディレクトリだと、serveStaticがその中のindex.htmlを
  // 配信してしまう。拡張子の判定を通り抜ける経路なので、通常ファイルかどうかも見る。
  const realAbsPath = await realpath(doc.absPath);
  const stats = await stat(realAbsPath).catch(() => undefined);
  return stats?.isFile() ? realAbsPath : undefined;
}
