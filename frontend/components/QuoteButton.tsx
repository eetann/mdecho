import { useLayoutEffect, useRef } from "react";

export function QuoteButton({
  anchorRect,
  onClick,
}: {
  anchorRect: DOMRect | null;
  onClick: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button || !anchorRect) return;
    const buttonWidth = button.offsetWidth || 0;
    const maxLeft = Math.max(8, window.innerWidth - buttonWidth - 8);
    button.style.top = `${Math.max(8, anchorRect.top - 40)}px`;
    button.style.left = `${Math.min(Math.max(8, anchorRect.left), maxLeft)}px`;
  }, [anchorRect]);

  return (
    <button
      ref={buttonRef}
      type="button"
      id="mdecho-reply-button"
      className={`mdecho-reply-button btn btn-primary btn-sm fixed z-[1000] transition-opacity duration-100 ${
        anchorRect ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      Quote
    </button>
  );
}
