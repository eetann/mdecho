export interface CursorScope {
  /** 動ける最初のindex */
  start: number;
  /** 動ける最後のindex(このindex自身も含む) */
  end: number;
}

/**
 * カーソルが動ける範囲を求める。inScopeはcursor targetsと同じ並びで、
 * それぞれが「今カーソルを置ける場所か」を表す。置ける場所が無ければnull。
 *
 * 表を拡大している間は、その表の行だけがtrueになる。外の行はモーダルの裏に隠れていて、
 * カーソルを送っても見えないため、両端のindexで挟んで動ける範囲を閉じる。
 */
export function findCursorScope(inScope: readonly boolean[]): CursorScope | null {
  const start = inScope.indexOf(true);
  if (start === -1) return null;
  return { start, end: inScope.lastIndexOf(true) };
}

/** indexを動ける範囲に収める。範囲の外にいた場合は近いほうの端へ寄る */
export function clampToCursorScope(index: number, scope: CursorScope): number {
  return Math.max(scope.start, Math.min(index, scope.end));
}
