// 幅は見る人の好みなので、タブをまたいでこのブラウザに覚えておく
const STORAGE_KEY = "mdecho:file-list-width";

/** 既定の幅(px)。以前の固定幅w-48(12rem)と同じ */
export const DEFAULT_FILE_LIST_WIDTH = 192;
export const MIN_FILE_LIST_WIDTH = 128;
/** 本文を潰しきらないよう、画面幅に対する割合でも上限を設ける */
const MAX_FILE_LIST_WIDTH = 640;
const MAX_FILE_LIST_RATIO = 0.4;

export function clampFileListWidth(width: number, viewportWidth: number): number {
  const max = Math.max(
    MIN_FILE_LIST_WIDTH,
    Math.min(MAX_FILE_LIST_WIDTH, viewportWidth * MAX_FILE_LIST_RATIO),
  );
  return Math.round(Math.min(max, Math.max(MIN_FILE_LIST_WIDTH, width)));
}

export function loadFileListWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_FILE_LIST_WIDTH;
    const value = Number(raw);
    return Number.isFinite(value) ? value : DEFAULT_FILE_LIST_WIDTH;
  } catch {
    return DEFAULT_FILE_LIST_WIDTH;
  }
}

export function saveFileListWidth(width: number): void {
  try {
    if (width === DEFAULT_FILE_LIST_WIDTH) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // localStorageが使えない環境では覚えないだけ
  }
}
