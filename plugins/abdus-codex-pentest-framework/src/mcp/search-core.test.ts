import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import {
  boundedContent,
  buildMarkdownDocuments,
  lookupDocument,
  searchDocuments,
  type SearchDocument,
} from "./search-core"

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "apf-mcp-test-"))
}

test("markdown search ranks headings and returns bounded section reads", () => {
  const dir = tempDir()
  try {
    mkdirSync(join(dir, "web"), { recursive: true })
    writeFileSync(
      join(dir, "web", "jwt.md"),
      [
        "# JWT Attacks",
        "",
        "General notes.",
        "",
        "## Algorithm Confusion",
        "",
        "If a service accepts HS256 where RS256 was expected, test key confusion with the public key as HMAC material.",
        "",
        "## Kid Header",
        "",
        "Check key lookup behavior.",
      ].join("\n"),
    )
    const docs = buildMarkdownDocuments(dir, "hacktricks")
    const results = searchDocuments(docs, "HS256 public key confusion", { limit: 3 })
    expect(results[0]?.document.id).toBe("web/jwt")
    expect(results[0]?.snippets[0]?.heading).toContain("Algorithm Confusion")
    const document = lookupDocument(docs, "web/jwt")
    expect(document?.title).toBe("JWT Attacks")
    const section = boundedContent(document?.content ?? "", 1000, "algorithm")
    expect(section.content).toContain("HS256")
    expect(section.content).not.toContain("Kid Header")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("search filters by path and document metadata", () => {
  const docs: SearchDocument[] = [
    {
      id: "http/cve-test",
      title: "Example HTTP CVE",
      kind: "nuclei-template",
      absolutePath: "/tmp/http/cve-test.yaml",
      relativePath: "http/cve-test.yaml",
      content: "id: cve-test\nseverity: critical\ntags: cve,rce\n",
      metadata: { severity: "critical", tags: ["cve", "rce"], protocol: "http" },
      headings: [],
      chunks: [{ startLine: 1, endLine: 3, text: "critical remote code execution cve template" }],
      weightedText: "critical cve rce http",
    },
    {
      id: "dns/info-test",
      title: "DNS Info",
      kind: "nuclei-template",
      absolutePath: "/tmp/dns/info-test.yaml",
      relativePath: "dns/info-test.yaml",
      content: "id: info-test\nseverity: info\ntags: dns\n",
      metadata: { severity: "info", tags: ["dns"], protocol: "dns" },
      headings: [],
      chunks: [{ startLine: 1, endLine: 3, text: "dns information disclosure template" }],
      weightedText: "info dns",
    },
  ]
  const results = searchDocuments(docs, "template", {
    pathFilter: "http",
    filter: (document) => document.metadata.severity === "critical",
  })
  expect(results).toHaveLength(1)
  expect(results[0]?.document.id).toBe("http/cve-test")
})
