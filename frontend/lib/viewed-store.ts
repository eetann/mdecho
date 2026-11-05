// コメントと同じく、このタブの中だけで覚えておく。
const STORAGE_KEY = "mdecho:viewed";

/**
 * 「見た」チェックを付けたファイル。値はチェックを付けたときのファイルの内容のハッシュで、
 * 今のハッシュと違えば(AIが書き換えたなど)未読に戻ったとみなす。
 */
export type ViewedMap = Record<string, string>;

export function loadViewed(): ViewedMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    // sessionStorageが使えない、または壊れたデータは無視
    return {};
  }
}

export function saveViewed(viewed: ViewedMap): void {
  try {
    if (Object.keys(viewed).length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(viewed));
  } catch {
    // sessionStorageが使えない環境(プライベートブラウジング等)は無視
  }
}

/** チェックを付けたときから内容が変わっていなければ既読。ハッシュが取れないファイルは既読にしない */
export function isViewed(viewed: ViewedMap, relPath: string, hash: string): boolean {
  return hash !== "" && viewed[relPath] === hash;
}

/** relPathの既読を切り替えた新しいViewedMapを返す */
export function toggleViewed(viewed: ViewedMap, relPath: string, hash: string): ViewedMap {
  const next = { ...viewed };
  if (isViewed(viewed, relPath, hash)) {
    delete next[relPath];
  } else {
    next[relPath] = hash;
  }
  return next;
}
