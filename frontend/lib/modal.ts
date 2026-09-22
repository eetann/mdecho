/** 表の拡大表示は<dialog>ではないので、セレクタで個別に拾う */
const MODAL_SELECTOR = "dialog[open], .mdecho-table-modal";

/**
 * モーダルが開いているかどうか。
 * 開いている間は本文側のキーボード操作(j/k/Enterなど)を止めて、
 * 背後の本文が勝手に動いたりコメント欄が開いたりしないようにする。
 */
export function isModalOpen(): boolean {
  return document.querySelector(MODAL_SELECTOR) !== null;
}
