# Abdus Codex Pentest Framework

Codex-first pentest workspace framework for scoped bug bounty and application security work.

The framework is intentionally thin. It provides:

- Workspace state and artifact conventions under `framework/`, `access/`, `evidence/`, `findings/`, `poc/`, and `reports/`.
- Root `AGENTS.md` instructions for Codex.
- Project-local `.codex/skills` for APF-style bounded workstreams and recon methodology.
- A generated `.codex/config.toml` snippet for local MCP servers.
- Reusable local MCP servers for HackTricks, nuclei templates, and Claude-BugHunter search/read workflows.

It does not provide OpenCode plugin tools. Codex work is file-based: update normal workspace artifacts directly and record bounded parallel work under `framework/runners/<swarm-id>/`.

## Build

```bash
cd abdus-codex-pentest-framework
bun install
bun run build
```

## Install Into A Target Directory

```bash
abdus-codex-pentest-framework init /path/to/target
```

Or from this repo without putting the bin on `PATH`:

```bash
node bin/abdus-codex-pentest-framework.js init /path/to/target
```

The target receives:

```text
AGENTS.md
.codex/README.md
.codex/config.toml
.codex/install.sh
.codex/skills/apf-codex-swarms/SKILL.md
.codex/skills/bug-bounty-recon-methodology/SKILL.md
framework/*
program/
access/*
evidence/
findings/*
poc/
reports/
tools/*
```

Open Codex in the target directory. Codex ingests root `AGENTS.md` and project-local `.codex/skills` automatically.

## MCP Options

The generated `.codex/config.toml` always includes local browser and scanner MCP entries:

- `chrome-devtools`
- `playwright`
- `nmap`
- `sqlmap`

Add local reference and intel MCPs at install time:

```bash
abdus-codex-pentest-framework init /path/to/target --with-pentest-mcps
abdus-codex-pentest-framework init /path/to/target --with-cve-mcp
abdus-codex-pentest-framework init /path/to/target --with-all-mcps
```

Reference MCPs:

- `hacktricks`: `hacktricks_search`, `hacktricks_read`, `hacktricks_outline`, `hacktricks_stats`
- `nuclei_templates`: `nuclei_search`, `nuclei_read`, `nuclei_stats`
- `bughunter`: `bughunter_search`, `bughunter_read`, `bughunter_outline`, `bughunter_stats`
- `cve_mcp`: external CVE/security-intelligence tools from `mukul975/cve-mcp-server`

Override local roots when needed:

```bash
abdus-codex-pentest-framework init /path/to/target \
  --with-pentest-mcps \
  --hacktricks-root /home/sushi/hacktricks \
  --nuclei-templates-root /home/sushi/nuclei-templates \
  --bughunter-root /home/sushi/work/abdu/Claude-BugHunter
```

Register custom MCPs in the target snippet:

```bash
abdus-codex-pentest-framework init /path/to/target --mcp my_mcp=node,/path/to/server.js
```

The CLI does not edit `~/.codex/config.toml`. Merge the generated `.codex/config.toml` into the user-level Codex config when the MCP servers should be available to Codex.

## Skills

The target-local skills are:

- `apf-codex-swarms`: APF-style bounded workstreams using normal files under `framework/runners/`.
- `bug-bounty-recon-methodology`: recon, endpoint discovery, tech fingerprinting, and prioritization playbook.

Run `.codex/install.sh` inside a target if you want those skills symlinked into `~/.codex/skills` for use outside the target root.

## Codex Swarms

Codex does not have APF-specific `framework_status`, `swarm_create`, `swarm_collect`, or `runner_result` tools. The Codex version uses normal artifacts:

```text
framework/runners/<swarm-id>/index.json
framework/runners/<swarm-id>/<runner-id>.md
framework/runners/<swarm-id>/<runner-id>-result.json
```

Typical flow:

```text
User: create a 4-runner APF swarm for scoped API authz hypotheses
Codex loads apf-codex-swarms.
Codex reads scope/state artifacts.
Codex creates bounded runner prompts and result-file contracts.
Codex executes the workstreams in parallel when available, or sequentially with the same artifact shape.
Codex summarizes results and changed paths.
```

## Workspace Artifacts

`framework/state.json` is the compact source of truth. `framework/status.md` is a rendered summary.

Key directories:

```text
framework/
program/
access/secrets/
access/tokens/
access/network/
intel/
findings/candidates/
findings/debates/
evidence/
browser/profiles/
browser/sessions/
browser/captures/
poc/
reports/
tools/
```

## Policies

- Stay inside documented authorization and scope.
- Reuse local owned-account auth/session artifacts before attempting signin/signup.
- Do not print raw secrets, cookies, or tokens in chat or reports.
- Do not run `mullvad connect` or `mullvad disconnect`; use explicit operator-provided egress/proxy instructions.
- Treat scanner output and search results as hypotheses, not proof.
- Keep default proof/report work focused on high and critical target impact.
