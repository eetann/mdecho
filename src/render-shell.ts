export interface ShellData {
  title: string;
  bodyHtml: string;
  filePath: string;
  /** <head>の末尾に差し込む追加CSS(ユーザー設定のフォント指定など)。空なら注入しない */
  headCss?: string;
}

const DATA_SCRIPT_PATTERN = /(<script id="mdecho-data"[^>]*>)([\s\S]*?)(<\/script>)/;
const TITLE_TAG_PATTERN = /(<title>)([\s\S]*?)(<\/title>)/;
// バンドル済みJSの中にも"</head>"という文字列が現れうるが、それはbody末尾のscript内なので
// 文書本来の</head>より必ず後ろにある。replaceは最初の1件だけを置換するため衝突しない。
const HEAD_CLOSE_PATTERN = /<\/head>/;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toInlineJson(value: unknown): string {
  // JSON中に"</script>"相当の文字列(bodyHtmlやコメント本文の<script>タグ言及など)が
  // 含まれていても、埋め込み先の<script>タグを早期に閉じてしまわないようにする。
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/**
 * ビルド済みのdist/client/index.html(clientTemplate)に、リクエストごとの初期データと
 * タイトルを注入する。`id="mdecho-data"`のプレースホルダーscript要素と<title>要素を
 * 属性/タグ名をアンカーにした正規表現で置換する。
 */
export function renderShell(clientTemplate: string, data: ShellData): string {
  const { title, bodyHtml, filePath, headCss } = data;
  const withData = clientTemplate.replace(
    DATA_SCRIPT_PATTERN,
    (_match, open: string, _oldContent: string, close: string) =>
      `${open}${toInlineJson({ title, bodyHtml, filePath })}${close}`,
  );
  const withTitle = withData.replace(
    TITLE_TAG_PATTERN,
    (_match, open: string, _oldContent: string, close: string) =>
      `${open}${escapeHtml(title)}${close}`,
  );

  const trimmedCss = headCss?.trim();
  if (!trimmedCss) {
    return withTitle;
  }
  // styles.cssは<head>のこれより前に置かれるため、同じ詳細度の後勝ちで上書きできる。
  return withTitle.replace(
    HEAD_CLOSE_PATTERN,
    () => `<style id="mdecho-config-style">\n${trimmedCss}\n</style></head>`,
  );
}
