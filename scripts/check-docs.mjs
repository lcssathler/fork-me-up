import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";
import { checkDocuments } from "./docs-check.mjs";

try {
  const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
  const listing = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      timeout: 10_000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  if (listing.status !== 0 || listing.error) throw new Error("inventory");
  const files = new Set(listing.stdout.split("\0").filter(Boolean));
  if (files.size > 10_000) throw new Error("inventory-limit");
  for (const file of [...files]) {
    let parent = path.posix.dirname(file);
    while (parent !== ".") {
      files.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  files.add(".");
  const documents = new Map();
  let bytes = 0;
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const native = path.join(root, file);
    const relative = path.relative(root, realpathSync(native));
    const stat = lstatSync(native);
    if (
      relative.startsWith(`..${path.sep}`) ||
      relative === ".." ||
      path.isAbsolute(relative) ||
      stat.isSymbolicLink() ||
      !stat.isFile() ||
      stat.size > 1024 * 1024
    )
      throw new Error("document-boundary");
    bytes += stat.size;
    if (documents.size >= 1000 || bytes > 10 * 1024 * 1024) throw new Error("document-limit");
    documents.set(file, new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(native)));
  }
  const result = checkDocuments(documents, files);
  for (const error of result.errors) console.error(`${error.file}: ${error.code}`);
  console.log(
    `Documentation: ${result.documents} files, ${result.links} local links, ${result.fragments} heading fragments, ${result.errors.length} errors.`,
  );
  process.exitCode = result.errors.length ? 1 : 0;
} catch {
  console.error(
    "Documentation inventory/read failed; check the repository, Git availability and document bounds.",
  );
  process.exitCode = 1;
}
