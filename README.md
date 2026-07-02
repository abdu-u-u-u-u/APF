# acpf Marketplace

This repository is a Codex plugin marketplace.

It publishes one plugin:

- `abdus-codex-pentest-framework`: Codex-first APF workspace scaffolding, pentest skills, and local MCP wiring. Durable organizational knowledge (targets, surfaces, lanes, maps, findings, reports) is represented in the [Open Knowledge Format (OKF) v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).

## Install

```bash
codex plugin marketplace add abdullah-suhayl/abdus-codex-pentest-framework --ref main
codex plugin add abdus-codex-pentest-framework@abdus-codex
```

Start a new Codex thread after install so the plugin skills and MCP declarations are loaded.

The plugin ships APF skills, local MCP declarations, the `acpf` workspace spinup command, and the bundled Pentest Intel Corpus webapp. Use it from Codex prompts:

```text
@acpf initialize an APF workspace for this HackerOne program
@acpf spin up the pentest intel corpus and register this workspace
@acpf configure optional local scanner, reference, and Burp Suite MCPs
```

Or create a target workspace from the shell:

```bash
acpf spinup ./targets/acme --target acme.com
cd ./targets/acme
codex --search
```

Then type `start` in Codex.

## Plugin Source

The plugin lives at:

```text
plugins/abdus-codex-pentest-framework/
```

Build and test from that directory:

```bash
cd plugins/abdus-codex-pentest-framework
bun install
bun run build
bun test src/**/*.test.ts
bun run typecheck
```

## License

MIT. Free to use, modify, distribute, and sell for commercial and non-commercial purposes.
