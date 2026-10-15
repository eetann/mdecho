/**
 * 句点分割された文(.mdecho-sentence)が既に占めている行の要素を取り除く。
 * 分割された段落の<p>や、それを包む<li>/<blockquote>は文と同じ行から始まるので、
 * 文を個別targetにする以上は重複になる。
 * 一方、ネストしたリストの親<li>のように、子孫に文を持っていても自身の行が別なら残す
 * (子孫に文があるかどうかで判定すると、親の行がtargetから丸ごと消えてしまう)。
 */
export function excludeLinesCoveredBySentences<T>(
  elements: readonly T[],
  sentenceLines: ReadonlySet<number>,
  lineOf: (el: T) => number,
): T[] {
  return elements.filter((el) => !sentenceLines.has(lineOf(el)));
}
