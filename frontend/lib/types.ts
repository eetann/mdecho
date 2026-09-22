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

export interface MdechoSettings {
  font: FontSettings;
  /** 設定ファイルに書かれている改行の設定(モーダルが編集する対象) */
  lineBreak: LineBreakSettings;
  /**
   * CLIフラグで固定されている改行の設定。ここにある項目は設定ファイルより優先されるため、
   * 保存してもこの起動中の表示は変わらない。
   */
  lineBreakOverride: Partial<LineBreakSettings>;
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
