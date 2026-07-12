# acpf

Codex-, Claude Code-, and OpenCode-compatible APF pentest workspace framework for bug bounty and application security work.

This repository ships one plugin:

- `abdus-codex-pentest-framework`: APF workspace scaffolding, pentest skills, and local MCP wiring. Durable organizational knowledge (targets, surfaces, lanes, maps, findings, reports) is represented in the [Open Knowledge Format (OKF) v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).

This repo is not a marketplace. It ships the plugin source plus a separately linked `acpf` CLI; use it directly, or register the plugin in a marketplace of your own.

## Plugin Source

The plugin lives at:

```text
plugins/abdus-codex-pentest-framework/
```

It carries plugin manifests for Codex and Claude Code:

- Codex: `plugins/abdus-codex-pentest-framework/.codex-plugin/plugin.json`
- Claude Code: `plugins/abdus-codex-pentest-framework/.claude-plugin/plugin.json`

### Native Windows quick start

Native Windows is the primary path on the `windows` branch. Use Windows 10/11, PowerShell 7, Node.js 22.5 or newer, Bun, Git, Codex, and Google Chrome. Keep target workspaces near the drive root (for example `C:\apf\targets`) to leave room for APF's nested run paths.

```powershell
Set-Location .\plugins\abdus-codex-pentest-framework
bun install --frozen-lockfile
bun install --cwd corpus --frozen-lockfile
bun run build
bun run test
bun run typecheck
bun link
Get-Command acpf
```

If a PowerShell execution policy blocks a generated command shim, invoke the source checkout directly with `bun run acpf --` as shown below. See [Native Windows setup](plugins/abdus-codex-pentest-framework/docs/windows.md) for prerequisites, CLI/plugin installation, paths, optional tools, and troubleshooting.

Linux and WSL remain supported as secondary environments. Run the equivalent commands from Bash; do not mix a Windows Codex session with a workspace addressed through both `C:\...` and `/mnt/c/...` paths.

Build and test from that directory on Linux/WSL:

```bash
cd plugins/abdus-codex-pentest-framework
bun install --frozen-lockfile
bun install --cwd corpus --frozen-lockfile
bun run build
bun run test
bun run typecheck
```

`bun run test` uses the fast suite. Use `bun run test:full` for the two long orchestration stress suites as well.

## Use It

The primary entry point is the `acpf` CLI. Plugin installation loads skills; it does not by itself link the CLI into `PATH`. Link/install the package separately before using `acpf`.

On native Windows:

```powershell
Set-Location .\plugins\abdus-codex-pentest-framework
bun run acpf -- spinup 'C:\apf\targets\acme' --target acme.com
```

Open the generated workspace in Codex Desktop and say `start`, `begin`, `go`, `start recon`, or another clear request to begin. The root agent verifies and attaches the current Desktop task, then starts recon itself; `acpf` does not need to be globally linked or present on that task's `PATH`. Use `bun run acpf -- launch 'C:\apf\targets\acme' --runtime codex` only when you explicitly want a separate CLI-launched session.

After `bun link`, the shorter CLI forms are `acpf spinup ...` and `acpf launch ...`.

On Linux/WSL:

```bash
cd plugins/abdus-codex-pentest-framework
bun run acpf -- spinup ~/targets/acme --target acme.com
cd ~/targets/acme
```

Generated workspaces use platform-neutral Node helpers and Windows-first PowerShell runbooks on this branch. Codex and OpenCode read `AGENTS.md`; Claude Code reads `CLAUDE.md`, which imports `AGENTS.md`. Each workspace ships `.codex/`, `.claude/`, and `.opencode/` config/helper material plus workspace-local APF skills and scripts. Android-device commands under `/data/local/tmp` remain device-side shell commands and are valid from a Windows host through `adb shell`.

APF is agentic-first and hierarchical. The opened root session is the root manager; it delegates bounded phases and lanes to sub-managers, never directly to execution workers. Each sub-manager dispatches a research/pentest leaf wave and a unique independent `judge_leaf` for the attempt plus one for every finding candidate. Judge leaves check current web research, CVEs/advisories, tool documentation, and replay evidence, then return `advance`, `reject`, `retry_different_approach`, or `blocked`. Retries are capped at depth three; each requires a materially different approach, a new executor wave, and new judges. A mandatory judged `recon_mapping` phase publishes a sealed surfaced handoff; testing stays blocked until that recon run is successfully finalized. Finalized handoffs are indexed in `framework/manager-handoffs.jsonl` so sibling managers consume compact surfaced context. If the selected runtime cannot provide distinct live host-native sessions for this graph, APF stops before target work; identity strings in workspace files do not count as agent creation.

Codex Desktop multi-agent v1 has one narrow compatibility path when a bound sub-manager lacks nested spawn tools: the manager returns an `APF_DESKTOP_V1_PROXY_REQUEST`, and the root mechanically reserves, spawns, binds, attests, and dispatches its Luna/no-fork executor or judge leaves. The root performs no target work or judging and resumes the same logical manager with raw results. Desktop v2 keeps native sub-manager-to-leaf depth-2 spawning.

Every manager explicitly selects `gpt-5.6-luna` for every child-agent spawn—root to sub-manager and sub-manager to executor or judge leaf. APF does not permit inherited/default or fallback child models; an unavailable exact override is an orchestration blocker.

Codex Desktop is the supported live runtime for the attested Luna hierarchy. A clear natural-language start request is enough; exact literal matching is not required. Inactive runtime state, unknown authorization, unstarted recon, and a pending recon gate are normal startup conditions. The gate blocks testing until recon is judged and finalized, but it does not block starting recon.

## Register In Your Own Marketplace

If you want the normal plugin-install flow, add this plugin to a marketplace you control.

- Claude Code: create a `.claude-plugin/marketplace.json` in your marketplace repo with a `plugins` entry whose `source` points at `plugins/abdus-codex-pentest-framework`, then run `/plugin marketplace add <your-repo>` and `/plugin install abdus-codex-pentest-framework@<your-marketplace>`.
- Codex: add a marketplace manifest referencing the same plugin path, then run `codex plugin add abdus-codex-pentest-framework@<your-marketplace>`.

## License

MIT. Free to use, modify, distribute, and sell for commercial and non-commercial purposes.
