/** 設定・キーボードヘルプ・削除確認など、<dialog>で開くモーダル */
const DIALOG_SELECTOR = "dialog[open]";
/** 表の拡大表示は<dialog>ではないので、セレクタで個別に拾う */
const TABLE_MODAL_SELECTOR = ".mdecho-table-modal";

/**
 * <dialog>のモーダルが開いているかどうか。
 * 開いている間は本文側のキーボード操作(j/k/Enterなど)を止めて、
 * 背後の本文が勝手に動いたりコメント欄が開いたりしないようにする。
 */
export function isDialogOpen(): boolean {
  return document.querySelector(DIALOG_SELECTOR) !== null;
}

/**
 * 開いている表の拡大表示。開いていなければnull。
 * 拡大中も本文側のキーボード操作は生かすが、見えているのはこの中だけなので、
 * カーソルの移動もコメントもここに含まれる行に限る。
 */
export function getOpenTableModal(): Element | null {
  return document.querySelector(TABLE_MODAL_SELECTOR);
}
