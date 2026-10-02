import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * 相対パスを、配信先のURLのパスへ解決する関数。解決できないものはundefinedを返す(書き換えない)。
 * 渡すのは`?`や`#`より前の、パーセントエンコードされたままのパス。
 */
export type ResolveRelativeUrl = (path: string) => Promise<string | undefined>;

/**
 * `ResolveRelativeUrl`を渡すときの、vfileの`data`のキー。
 * プロセッサは改行設定ごとに使い回しているため、ファイルごとに変わる関数はプラグインの
 * オプションではなく、処理するvfileの側に持たせる。
 */
export const RESOLVE_RELATIVE_URL_DATA_KEY = "mdechoResolveRelativeUrl";

/** スキームや`//host`を持たない、ファイルを指す相対参照か(`#見出し`だけのものは除く) */
function isRelativePath(url: string): boolean {
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !url.startsWith("/") && !url.startsWith("#");
}

/**
 * `<a href>`と`<img src>`の相対パスを、vfileに渡された関数で解決し直す。
 * 関数が渡されていなければ何もしない(コメント本文のように、基準になるファイルが無い場合)。
 *
 * 先頭が`/`のパスは書き換えない。ファイルシステムの絶対パスかリポジトリのルート基準か、
 * どちらの意味で書かれたのか決めていないため、今は配信範囲のルート基準のまま扱う。
 *
 * rehypeBlockUnsafeUrlより後に置くこと(弾かれて属性が消えた要素を相手にしないため)。
 */
export const rehypeResolveRelativeUrl: Plugin<[], Root> = function rehypeResolveRelativeUrl() {
  return async (tree, file) => {
    const resolveUrl = file.data[RESOLVE_RELATIVE_URL_DATA_KEY];
    if (typeof resolveUrl !== "function") return;

    const targets: { node: Element; attribute: "href" | "src"; url: string }[] = [];
    visit(tree, "element", (node) => {
      const attribute = node.tagName === "a" ? "href" : node.tagName === "img" ? "src" : undefined;
      if (attribute === undefined) return;
      const url = node.properties[attribute];
      if (typeof url !== "string" || url === "" || !isRelativePath(url)) return;
      targets.push({ node, attribute, url });
    });

    await Promise.all(
      targets.map(async ({ node, attribute, url }) => {
        const suffixStart = url.search(/[?#]/);
        const path = suffixStart === -1 ? url : url.slice(0, suffixStart);
        const suffix = suffixStart === -1 ? "" : url.slice(suffixStart);
        if (path === "") return;
        const resolved = await (resolveUrl as ResolveRelativeUrl)(path);
        if (resolved !== undefined) {
          node.properties[attribute] = `${resolved}${suffix}`;
        }
      }),
    );
  };
};
