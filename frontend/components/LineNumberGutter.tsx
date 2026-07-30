import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { useCursorLine } from "../hooks/useCursorLine.tsx";

interface LineNumberEntry {
  line: string;
  top: number;
  target: Element;
}

export function LineNumberGutter({
  markdownBodyRef,
}: {
  markdownBodyRef: RefObject<HTMLElement | null>;
}) {
  const { targets, setCursorToElement } = useCursorLine();
  const gutterRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<LineNumberEntry[]>([]);

  useLayoutEffect(() => {
    const gutter = gutterRef.current;
    const root = markdownBodyRef.current;
    if (!gutter || !root || targets.length === 0) {
      setEntries([]);
      return;
    }

    function render() {
      if (!gutter) return;
      const gutterRect = gutter.getBoundingClientRect();
      setEntries(
        targets.map((target) => {
          const rect = target.getBoundingClientRect();
          return {
            line: target.getAttribute("data-line") ?? "",
            top: rect.top - gutterRect.top,
            target,
          };
        }),
      );
    }

    render();

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(root);
    window.addEventListener("resize", render);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", render);
    };
  }, [targets, markdownBodyRef]);

  return (
    <div ref={gutterRef} className="mdecho-line-number-gutter relative w-[2.6em] flex-none">
      {entries.map((entry, index) => (
        <span
          key={index}
          className="mdecho-line-number absolute right-[0.6em] left-0 cursor-pointer font-mono text-[0.75em] text-base-content/40 whitespace-nowrap select-none hover:text-base-content/60"
          style={{ top: entry.top }}
          onClick={() => setCursorToElement(entry.target)}
        >
          {entry.line}
        </span>
      ))}
    </div>
  );
}
