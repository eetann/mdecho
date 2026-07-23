export const pageStyles = `
  :root {
    color-scheme: light;
  }

  body {
    margin: 0;
    padding: 2rem;
    display: flex;
    justify-content: center;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1f2328;
    background: #ffffff;
  }

  .mdecho-page {
    width: 100%;
    max-width: 48rem;
  }

  .mdecho-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }

  .mdecho-content {
    display: flex;
  }

  .mdecho-line-number-gutter {
    flex: none;
    width: 2.6em;
    position: relative;
  }

  .mdecho-copy-button {
    font: inherit;
    padding: 0.4em 0.9em;
    border: 1px solid #d1d9e0;
    border-radius: 6px;
    background: #f6f8fa;
    cursor: pointer;
  }

  .mdecho-copy-button:hover:not(:disabled) {
    background: #eaeef2;
  }

  .mdecho-copy-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .markdown-body {
    flex: 1;
    min-width: 0;
    line-height: 1.6;
    word-wrap: break-word;
  }

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.25;
  }

  .markdown-body h1 {
    font-size: 2em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #d1d9e0;
  }

  .markdown-body h2 {
    font-size: 1.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #d1d9e0;
  }

  .markdown-body h3 {
    font-size: 1.25em;
  }

  .markdown-body p {
    margin-top: 0;
    margin-bottom: 1em;
  }

  .markdown-body ul,
  .markdown-body ol {
    padding-left: 2em;
    margin-top: 0;
    margin-bottom: 1em;
  }

  .markdown-body blockquote {
    margin: 0 0 1em;
    padding: 0 1em;
    color: #59636e;
    border-left: 0.25em solid #d1d9e0;
  }

  .markdown-body table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;
    overflow-x: auto;
    display: block;
  }

  .markdown-body th,
  .markdown-body td {
    padding: 0.4em 0.8em;
    border: 1px solid #d1d9e0;
  }

  .markdown-body th {
    font-weight: 600;
    background: #f6f8fa;
  }

  .markdown-body code {
    padding: 0.2em 0.4em;
    font-size: 0.9em;
    background: #f6f8fa;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .markdown-body pre {
    padding: 1em;
    overflow-x: auto;
    border: 1px solid #d1d9e0;
    border-radius: 6px;
    line-height: 1.45;
  }

  .markdown-body pre code {
    display: block;
    padding: 0;
    background: transparent;
  }

  .markdown-body pre .line {
    display: inline-block;
    width: 100%;
  }

  .markdown-body [data-mdecho-cursor] {
    background: rgba(9, 105, 218, 0.08);
    box-shadow: inset 3px 0 0 #0969da;
    border-radius: 4px;
    scroll-margin-block: 3rem;
  }

  .markdown-body pre .line[data-mdecho-cursor] {
    border-radius: 0;
    margin-inline: -1em;
    padding-inline: 1em;
    width: calc(100% + 2em);
  }

  .markdown-body tr[data-mdecho-cursor] > td,
  .markdown-body tr[data-mdecho-cursor] > th {
    background: rgba(9, 105, 218, 0.08);
    box-shadow: inset 3px 0 0 #0969da;
  }

  .mdecho-comment-slot,
  .mdecho-comment-row td {
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 0.95em;
    white-space: normal;
  }

  .mdecho-comment-slot {
    display: block;
    margin: 0.5em 0 1em;
  }

  .markdown-body pre .mdecho-comment-slot {
    margin-inline: -1em;
    padding-inline: 1em;
    width: calc(100% + 2em);
    box-sizing: border-box;
  }

  .mdecho-comment-editor {
    border: 1px solid #0969da;
    border-radius: 6px;
    background: #f6f8fa;
    padding: 0.5em;
  }

  .mdecho-comment-textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    min-height: calc(3 * 1.4em);
    border: none;
    background: transparent;
    resize: vertical;
    font: inherit;
    line-height: 1.4;
  }

  .mdecho-comment-textarea:focus {
    outline: none;
  }

  .mdecho-comment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5em;
    margin-top: 0.5em;
  }

  .mdecho-comment-actions button {
    font: inherit;
    padding: 0.3em 0.8em;
    border: 1px solid #d1d9e0;
    border-radius: 6px;
    background: #ffffff;
    cursor: pointer;
  }

  .mdecho-comment-actions button.mdecho-comment-save {
    border-color: #0969da;
    background: #0969da;
    color: #fff;
  }

  .mdecho-comment-view {
    border-left: 3px solid #0969da;
    background: #f6f8fa;
    border-radius: 0 6px 6px 0;
    padding: 0.5em 0.75em;
    cursor: pointer;
    white-space: pre-wrap;
  }

  .mdecho-comment-view:hover {
    background: #eaeef2;
  }

  .mdecho-comment-view-label {
    opacity: 0.7;
    margin-right: 0.3em;
  }

  .mdecho-comment-line-ref {
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.75em;
    color: #59636e;
    margin-bottom: 0.4em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .mdecho-comment-line-ref::after {
    content: "";
    flex: 1;
    border-top: 1px dashed #d1d9e0;
  }

  .mdecho-comment-row td {
    padding: 0.75em;
  }

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6,
  .markdown-body p,
  .markdown-body li,
  .markdown-body blockquote,
  .markdown-body hr {
    position: relative;
  }

  .markdown-body h1:hover::before,
  .markdown-body h2:hover::before,
  .markdown-body h3:hover::before,
  .markdown-body h4:hover::before,
  .markdown-body h5:hover::before,
  .markdown-body h6:hover::before,
  .markdown-body p:hover::before,
  .markdown-body li:hover::before,
  .markdown-body blockquote:hover::before,
  .markdown-body hr:hover::before {
    content: "💬";
    position: absolute;
    left: -1.6em;
    opacity: 0.5;
    font-size: 0.9em;
  }

  .markdown-body td,
  .markdown-body th {
    position: relative;
  }

  .markdown-body tr:hover > td:first-child::before,
  .markdown-body tr:hover > th:first-child::before {
    content: "💬";
    position: absolute;
    left: -1.6em;
    opacity: 0.5;
    font-size: 0.9em;
  }

  .mdecho-line-number {
    position: absolute;
    left: 0;
    right: 0.6em;
    text-align: right;
    color: #99a1a8;
    font-size: 0.75em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    user-select: none;
    pointer-events: none;
    white-space: nowrap;
  }

  .mdecho-reply-button {
    position: fixed;
    z-index: 1000;
    font: inherit;
    font-size: 0.85em;
    padding: 0.3em 0.8em;
    border: none;
    border-radius: 6px;
    background: #0969da;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s ease;
  }

  .mdecho-reply-button-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .mdecho-reply-button:hover {
    background: #0757ba;
  }
`;
