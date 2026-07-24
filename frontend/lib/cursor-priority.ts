export const CURSOR_PRIORITY: Record<string, number> = {
  H1: 0,
  H2: 0,
  H3: 0,
  H4: 0,
  H5: 0,
  H6: 0,
  SPAN: 1,
  TR: 2,
  LI: 3,
  BLOCKQUOTE: 4,
  HR: 5,
  P: 6,
};

const FALLBACK_PRIORITY = 99;

export function priorityOf(tagName: string): number {
  return CURSOR_PRIORITY[tagName] ?? FALLBACK_PRIORITY;
}

export function comparePriority(tagNameA: string, tagNameB: string): number {
  return priorityOf(tagNameA) - priorityOf(tagNameB);
}
