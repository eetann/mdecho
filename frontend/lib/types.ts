export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

export interface FontSettings {
  body: string[];
  code: string[];
}

/** src/config.tsのLineBreakConfigと対応する */
export interface LineBreakSettings {
  /** 句点(。)ごとに表示上の改行を入れる */
  splitSentences: boolean;
  /** 単一改行(Enterキー1回)をそのまま表示上の改行にする */
  singleNewline: boolean;
}

/** src/layout-css.tsのLayoutConfigと対応する */
export interface LayoutSettings {
  /** 本文の最大幅(px)。画面がこれより広いときは左右に均等な余白が付く */
  contentWidth: number;
  /** 本文の文字サイズ(px)。見出しやコードはこれを基準にした比率で決まる */
  fontSize: number;
  /** 本文の行の高さ(文字サイズに対する倍率) */
  lineHeight: number;
}

export interface MdechoSettings {
  font: FontSettings;
  /** 設定ファイルに書かれている改行の設定(モーダルが編集する対象) */
  lineBreak: LineBreakSettings;
  /**
   * CLIフラグで固定されている改行の設定。ここにある項目は設定ファイルより優先されるため、
   * 保存してもこの起動中の表示は変わらない。
   */
  lineBreakOverride: Partial<LineBreakSettings>;
  /** 本文の幅・文字サイズ・行間 */
  layout: LayoutSettings;
  /** 設定モーダルからの保存先(表示用) */
  configFile: string;
  /** UIから保存できるか。JSONC/JSON以外の設定ファイルを使っている場合はfalse */
  editable: boolean;
}

export interface MdechoInitialData {
  title: string;
  bodyHtml: string;
  /** `-f`に渡したパスと同じ書き方で表した、表示中ファイルのパス(クリップボードに載る) */
  filePath: string;
  /** Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス */
  relPath: string;
  /** 同じ形式で表した`-f`のファイルのパス。ホームへ戻るボタンの表示に使う */
  entryRelPath: string;
  settings: MdechoSettings;
}

/** GET /api/fonts のレスポンス(src/system-fonts.tsのSystemFontと対応する) */
export interface SystemFont {
  name: string;
  aliases: string[];
}
