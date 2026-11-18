import type { FileChange } from "./types.ts";

/** ファイル一覧のバッジに出す短い表記。変わっていなければnull */
export function formatChangeBadge(change: FileChange): string | null {
  switch (change.status) {
    case "added":
      return "新規";
    case "modified":
      return `+${change.added} −${change.deleted}`;
    case "unchanged":
      return null;
  }
}

/** 本文の上のバナーに出す説明 */
export function formatChangeSummary(change: FileChange, changeCount: number): string {
  switch (change.status) {
    case "added":
      return `新規ファイル(${change.added}行)`;
    case "modified": {
      const lines = `+${change.added} −${change.deleted}行`;
      // 削除だけの変更は本文に印を付けられないので、か所数を出さずに削除だけだと伝える
      return changeCount === 0 ? `${lines}(削除のみ)` : `${lines}・変更${changeCount}か所`;
    }
    case "unchanged":
      return "変更なし";
  }
}
