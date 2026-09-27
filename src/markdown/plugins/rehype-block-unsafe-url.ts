import type { Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * リンク(`<a href>`)として通すスキーム。相対パスとページ内リンクはスキームを持たないため
 * この集合とは無関係に通る。`javascript:`・`vbscript:`・`data:`・`file:`などは全部ここに無い。
 */
const ALLOWED_LINK_SCHEMES = new Set(["http", "https", "mailto"]);

/** 画像(`<img src>`)として通すスキーム。`data:`だけは下のMIME判定で別途通す。 */
const ALLOWED_IMAGE_SCHEMES = new Set(["http", "https"]);

/**
 * `data:`の画像で通すMIMEタイプ。`<img>`から読む限りこれらはスクリプトを持てない。
 * `image/svg+xml`は中に`<script>`を書けるため、`<img>`経由では走らないとしても
 * URLを直接開かれると実行できてしまうので外してある。
 */
const ALLOWED_IMAGE_DATA_MIME_PATTERN = /^image\/(?:png|jpeg|gif|webp|avif|apng|bmp)[;,]/i;

/** RFC 3986のscheme。`java-script1+x:`のような形まで許して、判定は小文字化してから行う。 */
const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** 弾いたことを示す属性。frontend/styles.cssがこの属性で見た目を変える。 */
export const BLOCKED_URL_ATTRIBUTE = "data-mdecho-blocked";

/** title属性に載せる元URLの上限。data:のような長いURLでツールチップが埋まるのを防ぐ。 */
const MAX_TITLE_URL_LENGTH = 120;

/** ブラウザがURLの前後から取り除く文字(C0制御文字とスペース)か */
function isTrimmedAtEdges(character: string | undefined): boolean {
  if (character === undefined) {
    return false;
  }
  return (character.codePointAt(0) ?? 0) <= 0x20;
}

/**
 * ブラウザのURLパーサに合わせた前処理。タブ・改行・復帰は位置を問わず取り除かれ、
 * 先頭と末尾のC0制御文字とスペースも落とされるため、`java<TAB>script:`のような綴りでも
 * スキームは`javascript`として解釈される。
 *
 * Markdown経由だと、この手の文字はmdast-util-to-hastが`%09`のようにパーセントエンコードして
 * くれるのでここまで生では届かない(エンコードされた時点でスキームとして成立しなくなる)。
 * それでも正規化しておくのは、この判定関数をMarkdown以外の入口から呼んでも壊れないようにするため。
 */
function normalizeUrl(url: string): string {
  const withoutBreaks = url.replace(/[\t\n\r]/g, "");
  let start = 0;
  let end = withoutBreaks.length;
  while (start < end && isTrimmedAtEdges(withoutBreaks[start])) {
    start += 1;
  }
  while (end > start && isTrimmedAtEdges(withoutBreaks[end - 1])) {
    end -= 1;
  }
  return withoutBreaks.slice(start, end);
}

/** URLのスキームを小文字で返す。スキームを持たない相対参照はundefined。 */
function schemeOf(normalizedUrl: string): string | undefined {
  return SCHEME_PATTERN.exec(normalizedUrl)?.[1]?.toLowerCase();
}

/** リンク先として表示してよいURLか */
export function isSafeLinkUrl(url: string): boolean {
  const scheme = schemeOf(normalizeUrl(url));
  return scheme === undefined || ALLOWED_LINK_SCHEMES.has(scheme);
}

/** 画像の読み込み先として表示してよいURLか */
export function isSafeImageUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  const scheme = schemeOf(normalized);
  if (scheme === undefined || ALLOWED_IMAGE_SCHEMES.has(scheme)) {
    return true;
  }
  if (scheme === "data") {
    return ALLOWED_IMAGE_DATA_MIME_PATTERN.test(normalized.slice(normalized.indexOf(":") + 1));
  }
  return false;
}

function blockedTitle(url: string): string {
  const normalized = normalizeUrl(url);
  const shown =
    normalized.length > MAX_TITLE_URL_LENGTH
      ? `${normalized.slice(0, MAX_TITLE_URL_LENGTH)}…`
      : normalized;
  return `mdechoが安全でないURLを弾きました: ${shown}`;
}

/**
 * `javascript:`のようなスキームのリンク・画像を弾く。
 *
 * 生HTMLはremarkRehypeに`allowDangerousHtml`を渡していないため既に落ちているので、
 * URLを持つ要素はMarkdown記法から出てくる`<a href>`と`<img src>`の2つだけになる。
 *
 * 弾くときはエスケープして通すのではなく、styles/font.ts・styles/theme.tsと同じく
 * その値ごと落とす。ただしフォントや色と違って本文の一部なので、消えたことに気づけるよう
 * リンクはテキストだけ残し、画像はaltテキストへ差し替えて、どちらにも
 * `data-mdecho-blocked`と元URLを載せたtitleを付ける。
 *
 * rehypeExternalLinksより前に置くこと(弾いたリンクにtarget="_blank"を付けさせないため)。
 */
export const rehypeBlockUnsafeUrl: Plugin<[], Root> = function rehypeBlockUnsafeUrl() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "a") {
        const href = node.properties.href;
        if (typeof href !== "string" || isSafeLinkUrl(href)) return;
        // hrefを消すだけでリンクではなくなる。テキストと子要素はそのまま読ませる。
        delete node.properties.href;
        node.properties[BLOCKED_URL_ATTRIBUTE] = "";
        node.properties.title = blockedTitle(href);
        return;
      }

      if (node.tagName === "img") {
        const src = node.properties.src;
        if (typeof src !== "string" || isSafeImageUrl(src)) return;
        const alt = typeof node.properties.alt === "string" ? node.properties.alt : "";
        // src無しの<img>は壊れた画像アイコンになるだけなので、altを読めるspanへ差し替える。
        // altが空のときは中身も空になるが、その場合はCSSの:emptyが文言を補う。
        node.tagName = "span";
        node.children = alt.length > 0 ? [{ type: "text", value: alt }] : [];
        delete node.properties.src;
        delete node.properties.alt;
        delete node.properties.width;
        delete node.properties.height;
        node.properties[BLOCKED_URL_ATTRIBUTE] = "";
        node.properties.title = blockedTitle(src);
      }
    });
  };
};
