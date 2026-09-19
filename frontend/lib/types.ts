export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

export interface FontSettings {
  body: string[];
  code: string[];
}

export interface MdechoSettings {
  font: FontSettings;
  /** 設定モーダルからの保存先(表示用) */
  configFile: string;
  /** UIから保存できるか。JSONC/JSON以外の設定ファイルを使っている場合はfalse */
  editable: boolean;
}

export interface MdechoInitialData {
  title: string;
  bodyHtml: string;
  filePath: string;
  settings: MdechoSettings;
}

/** GET /api/fonts のレスポンス(src/system-fonts.tsのSystemFontと対応する) */
export interface SystemFont {
  name: string;
  aliases: string[];
}
