export interface ShellSettings {
  font: { body: string[]; code: string[] };
  /** 設定ファイルに書かれている改行の設定(設定モーダルが編集する対象) */
  lineBreak: { splitSentences: boolean; singleNewline: boolean };
  /**
   * CLIフラグで固定されている改行の設定。ここにある項目は設定ファイルより優先されるため、
   * 保存してもこの起動中の表示は変わらない(モーダルでその旨を伝えるために渡す)。
   */
  lineBreakOverride: Partial<{ splitSentences: boolean; singleNewline: boolean }>;
  /** 本文の幅など、見た目のレイアウトに関する設定 */
  layout: { contentWidth: number };
  /** 設定モーダルからの保存先(表示用) */
  configFile: string;
  /** UIから保存できるか。JSONC/JSON以外の設定ファイルを使っている場合はfalse */
  editable: boolean;
}

export interface ShellData {
  title: string;
  bodyHtml: string;
  /** `-f`に渡したパスと同じ書き方で表した、表示中ファイルのパス(クリップボード用) */
  filePath: string;
  /** Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス */
  relPath: string;
  /** 同じ形式で表した`-f`のファイルのパス。ホームへ戻るボタンの表示に使う */
  entryRelPath: string;
  settings: ShellSettings;
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
  const { title, bodyHtml, filePath, relPath, entryRelPath, settings, headCss } = data;
  const withData = clientTemplate.replace(
    DATA_SCRIPT_PATTERN,
    (_match, open: string, _oldContent: string, close: string) =>
      `${open}${toInlineJson({ title, bodyHtml, filePath, relPath, entryRelPath, settings })}${close}`,
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

/**
 * リンク先のファイルが無かったときのページ。
 * クライアントのバンドルを読まない最小限のHTMLにして、エントリのファイルへ戻る導線だけ置く。
 */
export function renderNotFoundPage(requestPath: string, entryRelPath: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 - mdecho</title>
<style>
body { margin: 0; display: grid; place-items: center; min-height: 100vh;
  font-family: system-ui, sans-serif; line-height: 1.8; color: #1f2937; background: #ffffff; }
main { padding: 2rem; max-width: 40rem; }
h1 { margin: 0 0 1rem; font-size: 1.5rem; }
code { background: #f3f4f6; border-radius: 0.25rem; padding: 0.1em 0.4em; }
a { color: #2563eb; }
@media (prefers-color-scheme: dark) {
  body { color: #e5e7eb; background: #1f2937; }
  code { background: #374151; }
  a { color: #93c5fd; }
}
</style>
</head>
<body>
<main>
<h1>ファイルが見つかりません</h1>
<p><code>${escapeHtml(requestPath)}</code> を表示できませんでした。</p>
<p>mdechoが開けるのは、<code>-f</code>で指定したMarkdownと同じディレクトリの中にあるファイルだけです。</p>
<p><a href="/">${escapeHtml(entryRelPath)} に戻る</a></p>
</main>
</body>
</html>
`;
}
