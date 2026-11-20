// 読み取りモードは読む人の都合なので、ファイルを切り替えたりリロードしたりしても続くよう
// このブラウザに覚えておく。サーバーのポートは起動ごとに変わる(originが変わる)ため、
// 実際に続くのは同じ起動の間だけになる。
const STORAGE_KEY = "mdecho:read-mode";

/** 保存済みの値。まだ切り替えたことが無ければnull(`--read`の指定に従う) */
export function loadReadMode(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

export function saveReadMode(readMode: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(readMode));
  } catch {
    // localStorageが使えない環境では覚えないだけ
  }
}

/**
 * 最初に読み取りモードで開くか。一度でも切り替えたらその値を、
 * まだなら`--read`の指定を使う(指定したまま切り替えても、次のファイルで戻らないように)。
 */
export function resolveInitialReadMode(stored: boolean | null, cliReadMode: boolean): boolean {
  return stored ?? cliReadMode;
}
