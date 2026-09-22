import type { Comment } from "./types.ts";

// ファイルをまたいで読み進められるため、コメントは表示中のファイルごとに分けて持つ。
const STORAGE_KEY_PREFIX = "mdecho:comments:";

export interface CommentStore {
  /** Markdownのあるディレクトリを起点にした相対パス */
  relPath: string;
  /** `-f`に渡したパスと同じ書き方で表した、そのファイルのパス(クリップボードに載る) */
  filePath: string;
  comments: Map<string, Comment>;
}

/**
 * relPathからはクリップボードに載せるパスを復元できないため、保存時に一緒に持っておく。
 * 他のファイルで書いたコメントをまとめてコピーするときに使う。
 */
interface StoredValue {
  filePath: string;
  comments: [string, Comment][];
}

function keyOf(relPath: string): string {
  return `${STORAGE_KEY_PREFIX}${relPath}`;
}

function parseStored(raw: string): StoredValue | undefined {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null) return undefined;
  const { filePath, comments } = value as Partial<StoredValue>;
  if (typeof filePath !== "string" || !Array.isArray(comments)) return undefined;
  return { filePath, comments };
}

export function loadComments(relPath: string): Map<string, Comment> {
  try {
    const raw = sessionStorage.getItem(keyOf(relPath));
    if (raw === null) return new Map();
    const stored = parseStored(raw);
    return stored === undefined ? new Map() : new Map(stored.comments);
  } catch {
    // sessionStorageが使えない、または壊れたデータは無視
    return new Map();
  }
}

export function saveComments(
  relPath: string,
  filePath: string,
  comments: Map<string, Comment>,
): void {
  const value: StoredValue = { filePath, comments: Array.from(comments.entries()) };
  try {
    // 全部消したファイルのエントリを残さないようにする。
    if (comments.size === 0) {
      sessionStorage.removeItem(keyOf(relPath));
      return;
    }
    sessionStorage.setItem(keyOf(relPath), JSON.stringify(value));
  } catch {
    // sessionStorageが使えない環境(プライベートブラウジング等)は無視
  }
}

function listKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key !== null && key.startsWith(STORAGE_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

/** 表示中のファイル以外に書かれたコメントを、パス順で返す(コメントが無いファイルは除く) */
export function loadOtherStores(currentRelPath: string): CommentStore[] {
  const stores: CommentStore[] = [];
  try {
    for (const key of listKeys()) {
      const relPath = key.slice(STORAGE_KEY_PREFIX.length);
      if (relPath === currentRelPath) continue;
      const raw = sessionStorage.getItem(key);
      if (raw === null) continue;
      const stored = parseStored(raw);
      if (stored === undefined || stored.comments.length === 0) continue;
      stores.push({ relPath, filePath: stored.filePath, comments: new Map(stored.comments) });
    }
  } catch {
    // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    return [];
  }
  return stores.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/** 開いているファイルの分も含め、このタブに残っているコメントをすべて消す */
export function clearAllComments(): void {
  try {
    // 削除しながら走査するとindexがずれるため、先にキーを集める。
    for (const key of listKeys()) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorageが使えない環境(プライベートブラウジング等)は無視
  }
}
