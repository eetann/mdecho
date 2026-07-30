import type {} from "mdast-util-to-hast";
import type { Paragraph, PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import type { Point } from "unist";
import { visit } from "unist-util-visit";

function advancePosition(start: Point, text: string, charIndex: number): Point {
  let line = start.line;
  let column = start.column;
  for (let i = 0; i < charIndex; i++) {
    if (text[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return {
    line,
    column,
    offset: start.offset === undefined ? undefined : start.offset + charIndex,
  };
}

interface SentenceGroup {
  nodes: PhrasingContent[];
  start: Point;
  end: Point;
}

/**
 * paragraph.childrenをトップレベルで走査し、text内の「。」ごとに文グループへ分割する。
 * strong/link/inlineCode等の非textノードは分割トリガーにせず現在の文グループへそのまま追加する
 * (太字やインラインコード内部の「。」では分割しない)。
 */
function splitIntoSentenceGroups(children: PhrasingContent[]): SentenceGroup[] {
  const groups: SentenceGroup[] = [];
  let currentNodes: PhrasingContent[] = [];
  let currentStart: Point | null = null;

  function flush(end: Point) {
    if (currentNodes.length === 0 || currentStart === null) return;
    groups.push({ nodes: currentNodes, start: currentStart, end });
    currentNodes = [];
    currentStart = null;
  }

  for (const child of children) {
    if (child.type === "text" && child.position) {
      const value = child.value;
      const nodeStart = child.position.start;
      let segStart = 0;
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== "。") continue;
        const segEnd = i + 1;
        const segStartPoint = advancePosition(nodeStart, value, segStart);
        const segEndPoint = advancePosition(nodeStart, value, segEnd);
        if (currentStart === null) currentStart = segStartPoint;
        const textNode: Text = {
          type: "text",
          value: value.slice(segStart, segEnd),
          position: { start: segStartPoint, end: segEndPoint },
        };
        currentNodes.push(textNode);
        flush(segEndPoint);
        segStart = segEnd;
      }
      if (segStart < value.length) {
        const segStartPoint = advancePosition(nodeStart, value, segStart);
        if (currentStart === null) currentStart = segStartPoint;
        const textNode: Text = {
          type: "text",
          value: value.slice(segStart),
          position: { start: segStartPoint, end: child.position.end },
        };
        currentNodes.push(textNode);
      }
    } else {
      if (currentStart === null && child.position) {
        currentStart = child.position.start;
      }
      currentNodes.push(child);
    }
  }

  const last = children[children.length - 1];
  if (currentNodes.length > 0 && currentStart !== null && last?.position) {
    groups.push({ nodes: currentNodes, start: currentStart, end: last.position.end });
  }

  return groups;
}

export const remarkSplitSentences: Plugin<[], Root> = function remarkSplitSentences() {
  return (tree: Root) => {
    visit(tree, "paragraph", (node: Paragraph) => {
      const groups = splitIntoSentenceGroups(node.children);
      if (groups.length <= 1) return;

      node.children = groups.map((group) => {
        const sentenceNode = {
          type: "mdechoSentence",
          children: group.nodes,
          position: { start: group.start, end: group.end },
          data: {
            hName: "span",
            hProperties: { className: ["mdecho-sentence"] },
          },
        };
        return sentenceNode as unknown as PhrasingContent;
      });
    });
  };
};
