export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

export interface MdechoInitialData {
  title: string;
  bodyHtml: string;
  filePath: string;
}
