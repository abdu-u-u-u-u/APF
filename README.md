# acpf

Codex-, Claude Code-, and OpenCode-compatible APF pentest workspace framework for bug bounty and application security work.

This repository ships one plugin:

- `abdus-codex-pentest-framework`: APF workspace scaffolding, pentest skills, and local MCP wiring. Durable organizational knowledge (targets, surfaces, lanes, maps, findings, reports) is represented in the [Open Knowledge Format (OKF) v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).

This repo is not a marketplace. It ships the plugin as source plus a shell command; use it directly, or register it in a marketplace of your own.

## Plugin Source

The plugin lives at:

```text
plugins/abdus-codex-pentest-framework/
```

It carries plugin manifests for Codex and Claude Code:

- Codex: `plugins/abdus-codex-pentest-framework/.codex-plugin/plugin.json`
- Claude Code: `plugins/abdus-codex-pentest-framework/.claude-plugin/plugin.json`

Build and test from that directory:

```bash
cd plugins/abdus-codex-pentest-framework
bun install
bun run build
bun test src/**/*.test.ts
bun run typecheck
```

## Use It

The primary entry point is the `acpf` workspace spinup command. Create a target workspace, then open it in Codex, OpenCode, or Claude Code:

```bash
cd plugins/abdus-codex-pentest-framework
bun run acpf -- spinup ~/targets/acme --target acme.com
cd ~/targets/acme
```

Generated workspaces are runtime-portable. Codex and OpenCode read `AGENTS.md`; Claude Code reads `CLAUDE.md`, which imports `AGENTS.md`. Each workspace ships `.codex/`, `.claude/`, and `.opencode/` config/helper material plus workspace-local APF skills and scripts.

APF is agentic-first and hierarchical. The opened root session is the root manager; it delegates bounded phases and lanes to sub-managers, never directly to execution workers. Each sub-manager dispatches a research/pentest leaf wave and a unique independent `judge_leaf` for the attempt plus one for every finding candidate. Judge leaves check current web research, CVEs/advisories, tool documentation, and replay evidence, then return `advance`, `reject`, `retry_different_approach`, or `blocked`. Retries are capped at depth three; each requires a materially different approach, a new executor wave, and new judges. A mandatory judged `recon_mapping` phase publishes a sealed surfaced handoff; testing stays blocked until that recon run is successfully finalized. Finalized handoffs are indexed in `framework/manager-handoffs.jsonl` so sibling managers consume compact surfaced context. If the selected runtime cannot provide distinct live host-native sessions for this graph, APF stops before target work; identity strings in workspace files do not count as agent creation.

```bash
# Codex
codex --search
# then type: start

# OpenCode
opencode
# then type: start

# Claude Code
claude
# then type: start

```

## Register In Your Own Marketplace

If you want the normal plugin-install flow, add this plugin to a marketplace you control.

- Claude Code: create a `.claude-plugin/marketplace.json` in your marketplace repo with a `plugins` entry whose `source` points at `plugins/abdus-codex-pentest-framework`, then run `/plugin marketplace add <your-repo>` and `/plugin install abdus-codex-pentest-framework@<your-marketplace>`.
- Codex: add a marketplace manifest referencing the same plugin path, then run `codex plugin add abdus-codex-pentest-framework@<your-marketplace>`.

## License

MIT. Free to use, modify, distribute, and sell for commercial and non-commercial purposes.
