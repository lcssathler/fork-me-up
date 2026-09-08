import path from "node:path";
import { Buffer } from "node:buffer";

export const entryBudgets = Object.freeze({
  "README.md": 7 * 1024,
  "AGENTS.md": 12 * 1024,
  "docs/HANDOFF.md": 3 * 1024,
  "docs/README.md": 6 * 1024,
  "docs/ROADMAP.md": 40 * 1024,
});

/** @param {string} text */
function prose(text) {
  let fence = "";
  return text
    .split(/\r?\n/u)
    .filter((line) => {
      const match = /^\s{0,3}(`{3,}|~{3,})/u.exec(line);
      if (match?.[1]) {
        const marker = match[1];
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = "";
        return false;
      }
      return !fence;
    })
    .join("\n");
}

/** @param {string} text */
export function headingIds(text) {
  const result = new Set();
  const visible = prose(text);
  for (const match of visible.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gmu)) {
    const base = (match[1] ?? "")
      .toLowerCase()
      .replace(/<[^>]*>/gu, "")
      .replace(/[^\p{L}\p{M}\p{N}_\s-]/gu, "")
      .replace(/\s/gu, "-");
    let id = base;
    let suffix = 0;
    while (result.has(id)) id = `${base}-${++suffix}`;
    result.add(id);
  }
  for (const match of visible.matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["']/giu)) {
    if (match[1]) result.add(match[1]);
  }
  return result;
}

/**
 * Repository Markdown conventions only; never loads external URLs or executes content.
 * @param {Map<string, string>} documents
 * @param {Set<string>} files Repository-relative files and directories.
 * @param {Readonly<Record<string, number>>} budgets
 */
export function checkDocuments(documents, files, budgets = entryBudgets) {
  /** @type {{file: string, code: string}[]} */
  const errors = [];
  let links = 0;
  let fragments = 0;
  const ids = new Map([...documents].map(([file, text]) => [file, headingIds(text)]));
  for (const [file, budget] of Object.entries(budgets)) {
    const text = documents.get(file);
    if (text === undefined) errors.push({ file, code: "missing-entry-document" });
    else if (Buffer.byteLength(text, "utf8") > budget)
      errors.push({ file, code: "entry-byte-budget" });
  }
  for (const [file, text] of documents) {
    const visible = prose(text);
    const targets = [
      ...[
        ...visible.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/gu),
      ].map((m) => m[1] ?? ""),
      ...[...visible.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gmu)].map((m) => m[1] ?? ""),
    ];
    for (const raw of targets) {
      const target = raw.replace(/^<|>$/gu, "");
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(target)) continue;
      links++;
      try {
        const hash = target.indexOf("#");
        const filePart = decodeURIComponent(
          (hash < 0 ? target : target.slice(0, hash)).split("?")[0] ?? "",
        );
        const fragment = hash < 0 ? "" : decodeURIComponent(target.slice(hash + 1));
        const resolved = filePart
          ? path.posix
              .normalize(
                filePart.startsWith("/")
                  ? filePart.slice(1)
                  : path.posix.join(path.posix.dirname(file), filePart),
              )
              .replace(/\/$/u, "")
          : file;
        if (resolved === ".." || resolved.startsWith("../") || resolved.includes("\\")) {
          errors.push({ file, code: "link-outside-repository" });
        } else if (!files.has(resolved) && !documents.has(resolved)) {
          errors.push({ file, code: "missing-link-target" });
        } else if (fragment && documents.has(resolved)) {
          fragments++;
          if (!ids.get(resolved)?.has(fragment)) errors.push({ file, code: "missing-heading" });
        }
      } catch {
        errors.push({ file, code: "invalid-link-encoding" });
      }
    }
  }
  return { documents: documents.size, links, fragments, errors };
}
