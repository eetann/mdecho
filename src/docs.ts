import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const DOCS_DIR = join(import.meta.dirname, "..", "docs");
const FRONTMATTER_DELIMITER = "---";
const DESCRIPTION_LINE_PATTERN = /^description:\s*(.+)$/;

export interface DocEntry {
  name: string;
  description: string;
}

export function parseFrontmatterDescription(source: string): {
  description: string;
  body: string;
} {
  const lines = source.split("\n");
  if (lines[0] !== FRONTMATTER_DELIMITER) {
    return { description: "", body: source };
  }

  const endIndex = lines.indexOf(FRONTMATTER_DELIMITER, 1);
  if (endIndex === -1) {
    return { description: "", body: source };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  let description = "";
  for (const line of frontmatterLines) {
    const match = DESCRIPTION_LINE_PATTERN.exec(line);
    if (match?.[1]) {
      description = match[1].trim();
      break;
    }
  }

  const body = lines
    .slice(endIndex + 1)
    .join("\n")
    .replace(/^\n+/, "");
  return { description, body };
}

export async function listDocs(): Promise<DocEntry[]> {
  const files = await readdir(DOCS_DIR);
  const entries: DocEntry[] = [];
  for (const file of files) {
    if (extname(file) !== ".md") {
      continue;
    }
    const source = await readFile(join(DOCS_DIR, file), "utf-8");
    const { description } = parseFrontmatterDescription(source);
    entries.push({ name: basename(file, ".md"), description });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readDoc(
  name: string,
): Promise<{ entry: DocEntry; body: string } | undefined> {
  const safeName = basename(name.endsWith(".md") ? name.slice(0, -3) : name);
  if (safeName !== name.replace(/\.md$/, "")) {
    return undefined;
  }

  try {
    const source = await readFile(join(DOCS_DIR, `${safeName}.md`), "utf-8");
    const { description, body } = parseFrontmatterDescription(source);
    return { entry: { name: safeName, description }, body };
  } catch {
    return undefined;
  }
}
