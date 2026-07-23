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

  .markdown-body {
    width: 100%;
    max-width: 48rem;
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
    padding: 0;
    background: transparent;
  }

  .markdown-body [data-mdecho-cursor] {
    background: rgba(9, 105, 218, 0.08);
    box-shadow: inset 3px 0 0 #0969da;
    border-radius: 4px;
    scroll-margin-block: 3rem;
  }

  .markdown-body tr[data-mdecho-cursor] > td,
  .markdown-body tr[data-mdecho-cursor] > th {
    background: rgba(9, 105, 218, 0.08);
    box-shadow: inset 3px 0 0 #0969da;
  }
`;
