export const lineNumberClientScript = `
(() => {
  let gutter = null;

  function renderLineNumbers() {
    if (!window.mdechoCursor || !gutter) return;
    gutter.innerHTML = "";

    const targets = window.mdechoCursor.getTargets();
    const gutterRect = gutter.getBoundingClientRect();

    for (const target of targets) {
      const line = target.getAttribute("data-line");
      const rect = target.getBoundingClientRect();
      const label = document.createElement("span");
      label.className = "mdecho-line-number";
      label.textContent = line;
      label.style.top = rect.top - gutterRect.top + "px";
      gutter.appendChild(label);
    }
  }

  function init() {
    if (!window.mdechoCursor) return;
    const root = document.querySelector(".markdown-body");
    gutter = document.querySelector(".mdecho-line-number-gutter");
    if (!root || !gutter) return;

    renderLineNumbers();

    const resizeObserver = new ResizeObserver(() => renderLineNumbers());
    resizeObserver.observe(root);
    window.addEventListener("resize", renderLineNumbers);
  }

  init();
})();
`;
