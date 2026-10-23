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

Open the generated workspace in Codex Desktop and state the goal naturally—`start`, `begin`, `go`, `start recon`, or a full pentest request all work. Work begins in that task without attachment ceremony; `acpf` does not need to be globally linked or present on the task's `PATH`. Use `bun run acpf -- launch 'C:\apf\targets\acme' --runtime codex` only when you explicitly want a separate CLI-launched session.

After `bun link`, the shorter CLI forms are `acpf spinup ...` and `acpf launch ...`.

On Linux/WSL:

```bash
cd plugins/abdus-codex-pentest-framework
bun run acpf -- spinup ~/targets/acme --target acme.com
cd ~/targets/acme
```

Generated workspaces use platform-neutral Node helpers and Windows-first PowerShell runbooks on this branch. Codex and OpenCode read `AGENTS.md`; Claude Code reads `CLAUDE.md`, which imports `AGENTS.md`. Each workspace ships `.codex/`, `.claude/`, and `.opencode/` config/helper material plus workspace-local APF skills and scripts. Android-device commands under `/data/local/tmp` remain device-side shell commands and are valid from a Windows host through `adb shell`.

APF Lite is root-first. A clear natural-language request starts target work immediately in the current task; exact wording is not required. Inactive runtime state, unstarted recon, and a pending gate are work inputs, not launcher or orchestration blockers.

For a broad pentest, broad recon, or open-ended finding goal, the root starts working and spawns one executor by default with a short work-only assignment. A narrow bounded goal may remain in the root task. Add a second executor only for a complementary independent branch; if no child slot is available, the root continues instead of blocking. Routine attempts do not create judges, while concrete finding candidates receive independent validation before promotion.

The reserve/bind/attest hierarchy, sub-managers, fixed Luna child model, and sealed run handoffs remain available only when the operator explicitly requests strict or audited mode. Those protocols do not appear in normal Lite child prompts.

## Register In Your Own Marketplace

If you want the normal plugin-install flow, add this plugin to a marketplace you control.

- Claude Code: create a `.claude-plugin/marketplace.json` in your marketplace repo with a `plugins` entry whose `source` points at `plugins/abdus-codex-pentest-framework`, then run `/plugin marketplace add <your-repo>` and `/plugin install abdus-codex-pentest-framework@<your-marketplace>`.
- Codex: add a marketplace manifest referencing the same plugin path, then run `codex plugin add abdus-codex-pentest-framework@<your-marketplace>`.

## License

MIT. Free to use, modify, distribute, and sell for commercial and non-commercial purposes.
