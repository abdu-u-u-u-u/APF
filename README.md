# acpf

Codex- and Claude Code-native APF pentest workspace framework for bug bounty and application security work.

This repository ships one plugin:

- `abdus-codex-pentest-framework`: APF workspace scaffolding, pentest skills, and local MCP wiring. Durable organizational knowledge (targets, surfaces, lanes, maps, findings, reports) is represented in the [Open Knowledge Format (OKF) v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).

This repo is not a marketplace. It ships the plugin as source plus a shell command; use it directly, or register it in a marketplace of your own.

## Plugin Source

The plugin lives at:

```text
plugins/abdus-codex-pentest-framework/
```

It carries a manifest for both runtimes:

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

The primary entry point is the `acpf` workspace spinup command. Create a target workspace, then open it in Codex or Claude Code:

```bash
cd plugins/abdus-codex-pentest-framework
bun run acpf -- spinup ~/targets/acme --target acme.com
cd ~/targets/acme
```

Generated workspaces are runtime-portable. Codex and OpenCode read `AGENTS.md`; Claude Code reads `CLAUDE.md` (which imports `AGENTS.md`). Each workspace ships `.codex/`, `.claude/`, and `.opencode/` config, subagents, and hooks.

```bash
# Codex
codex --search
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
