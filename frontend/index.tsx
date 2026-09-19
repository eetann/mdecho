import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import type { MdechoInitialData } from "./lib/types.ts";

function readInitialData(): MdechoInitialData {
  const el = document.getElementById("mdecho-data");
  if (!el?.textContent) {
    throw new Error("mdecho-data element not found");
  }
  return JSON.parse(el.textContent) as MdechoInitialData;
}

const data = readInitialData();
const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("root element not found");
}

createRoot(rootEl).render(
  <App bodyHtml={data.bodyHtml} filePath={data.filePath} settings={data.settings} />,
);
