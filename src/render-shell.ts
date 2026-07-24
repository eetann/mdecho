export interface ShellData {
  title: string;
  bodyHtml: string;
  filePath: string;
}

const DATA_SCRIPT_PATTERN = /(<script id="mdecho-data"[^>]*>)([\s\S]*?)(<\/script>)/;
const TITLE_TAG_PATTERN = /(<title>)([\s\S]*?)(<\/title>)/;

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
  const withData = clientTemplate.replace(
    DATA_SCRIPT_PATTERN,
    (_match, open: string, _oldContent: string, close: string) =>
      `${open}${toInlineJson(data)}${close}`,
  );
  return withData.replace(
    TITLE_TAG_PATTERN,
    (_match, open: string, _oldContent: string, close: string) =>
      `${open}${escapeHtml(data.title)}${close}`,
  );
}
