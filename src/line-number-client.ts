export const lineNumberClientScript = `
(() => {
  function renderLineNumbers() {
    if (!window.mdechoCursor) return;
    const targets = window.mdechoCursor.getTargets();
    for (const target of targets) {
      const line = target.getAttribute("data-line");
      const label = document.createElement("span");
      label.className = "mdecho-line-number";
      label.textContent = line;
      label.setAttribute("aria-hidden", "true");

      const host = target.tagName === "TR" ? target.querySelector("td, th") : target;
      if (host) host.prepend(label);
    }
  }

  renderLineNumbers();
})();
`;
