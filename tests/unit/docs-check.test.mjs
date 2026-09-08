import assert from "node:assert/strict";
import test from "node:test";
import { checkDocuments, headingIds } from "../../scripts/docs-check.mjs";

test("document links resolve after relocation, including headings, reference definitions and explicit anchors", () => {
  const documents = new Map([
    [
      "README.md",
      "[History](docs/history/a.md#result)\n[guide]: <docs/guide.md#usage>\n[anchor](docs/guide.md#explicit)",
    ],
    ["docs/history/a.md", "# Result\n[Back](../../README.md)"],
    ["docs/guide.md", '# Usage\n<a id="explicit"></a>'],
  ]);
  const result = checkDocuments(documents, new Set(documents.keys()), {});
  assert.deepEqual(result.errors, []);
  assert.equal(result.links, 4);
  assert.equal(result.fragments, 3);
});

test("missing files, headings and malformed encoding fail with fixed diagnostics", () => {
  const documents = new Map([
    ["README.md", "[missing](absent.md) [heading](#absent) [invalid](%ZZ)"],
  ]);
  const result = checkDocuments(documents, new Set(), {});
  assert.deepEqual(
    result.errors.map((e) => e.code),
    ["missing-link-target", "missing-heading", "invalid-link-encoding"],
  );
});

test("entry budgets count UTF-8 bytes and reject missing required documents", () => {
  const documents = new Map([["README.md", "é"]]);
  assert.equal(checkDocuments(documents, new Set(), { "README.md": 2 }).errors.length, 0);
  assert.deepEqual(
    checkDocuments(documents, new Set(), { "README.md": 1, "AGENTS.md": 1 }).errors.map(
      (e) => e.code,
    ),
    ["entry-byte-budget", "missing-entry-document"],
  );
});

test("heading slugs handle punctuation, Unicode, duplicate collisions and code fences", () => {
  assert.deepEqual(
    [...headingIds("# Café / API\n# Usage\n# Usage\n# Usage-1\n~~~text\n# Hidden\n~~~")],
    ["café--api", "usage", "usage-1", "usage-1-1"],
  );
});

test("external URLs and fenced examples are not opened or validated as local links", () => {
  const documents = new Map([
    ["README.md", "[web](https://example.invalid)\n```md\n[example](missing.md)\n```\n"],
  ]);
  assert.equal(checkDocuments(documents, new Set(), {}).links, 0);
});

test("encoded escape and backslash paths fail while repository directories are accepted", () => {
  const documents = new Map([
    ["README.md", "[bad](%2e%2e/secret) [bad](docs%5csecret.md) [directory](docs/)"],
  ]);
  const result = checkDocuments(documents, new Set(["docs"]), {});
  assert.deepEqual(
    result.errors.map((e) => e.code),
    ["link-outside-repository", "link-outside-repository"],
  );
});
