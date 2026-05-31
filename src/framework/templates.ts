export const FRAMEWORK_DIRECTORIES = [
  "framework",
  "framework/notes",
  "framework/runners",
  "program",
  "access/secrets",
  "access/tokens",
  "access/network",
  "intel",
  "findings/candidates",
  "findings/debates",
  "evidence",
  "browser/profiles",
  "browser/sessions",
  "browser/captures",
  "poc",
  "reports",
  "tools",
] as const

export const OPERATOR_SECRET_POLICY_LINES = [
  "Local operational secrets are allowed in access/secrets, access/tokens, browser/profiles, and browser/sessions.",
  "Use credentials, cookies, tokens, browser profiles, proxy files, and capture scripts from those local paths as runtime inputs when the task needs them.",
  "Do not redact, delete, rotate, relocate, or rewrite operational credentials, cookies, browser profiles, proxy files, token files, or auth/session capture scripts unless the user explicitly asks for that cleanup.",
  "Raw values may be stored, copied, replayed, and transformed inside workspace-local operator artifacts when needed for owned-account testing.",
  "Preserve working sign-in and capture mechanics. Assistant-visible chat output, command summaries, public evidence summaries, and reports should use artifact paths or summaries instead of raw values.",
] as const

export const ACCEPTANCE_POLICY_LINES = [
  "Only high and critical impact findings are accepted for proof/report work by default.",
  "Informational, low, and medium findings are not accepted as standalone submissions.",
  "Informational, low, and medium observations may be kept only as chain components, blockers, or notes when they help prove a high/critical exploit path.",
  "Do not promote or report a candidate unless the target-specific impact is high/critical or the candidate is explicitly part of a high/critical chain.",
  "Scanner-only matches, dependency sightings, hardening issues, missing flags, and availability-only DoS stay non-reportable unless evidence shows high/critical account, data, or business impact.",
] as const

export const FRAMEWORK_TEMPLATE_FILES: Record<string, string> = {
  "framework/state.json": `{
  "schema": "abdus-pentest-framework.state.v1",
  "status": "initialized",
  "created_at": "1970-01-01T00:00:00.000Z",
  "updated_at": "1970-01-01T00:00:00.000Z",
  "single_ai": {
    "agent": "pentester",
    "no_subagents": false,
    "no_judge_workflow": true
  },
  "target": {
    "authorization": "unknown"
  },
  "next_actions": [
    "Run framework_init, ingest program scope, then keep framework/state.json and framework/status.md current as work proceeds."
  ],
  "lanes": {
    "scope": {
      "state": "not_started"
    },
    "web_api": {
      "state": "not_started"
    },
    "browser": {
      "state": "not_started"
    },
    "mobile": {
      "state": "not_started"
    },
    "repo": {
      "state": "not_started"
    },
    "intel": {
      "state": "not_started"
    },
    "auth": {
      "state": "not_started"
    }
  },
  "findings": {}
}
`,
  "framework/operator-policy.json": `{
  "schema": "abdus-pentest-framework.operator-policy.v1",
  "secrets": {
    "mode": "operator",
    "preserve_operational_secrets": true,
    "allowed_secret_dirs": [
      "access/secrets",
      "access/tokens",
      "browser/profiles",
      "browser/sessions"
    ],
    "redact_chat_output": true,
    "redact_reports": true,
    "never_sanitize_local_auth_scripts_without_request": true
  }
}
`,
  "framework/acceptance-policy.json": `{
  "schema": "abdus-pentest-framework.acceptance-policy.v1",
  "accepted_report_severities": [
    "high",
    "critical"
  ],
  "rejected_standalone_severities": [
    "informational",
    "info",
    "low",
    "medium"
  ],
  "allow_rejected_severities_as_chain_components": true,
  "candidate_threshold": "high_or_critical_target_impact",
  "report_threshold": "proven_high_or_critical_in_scope_impact"
}
`,
  "framework/severity-policy.json": `{
  "schema": "abdus-pentest-framework.severity-policy.v1",
  "model": "cvss_v4_qualitative",
  "accepted_report_bands": [
    "high",
    "critical"
  ],
  "high_critical_requires": [
    "target_specific_impact",
    "proven_exploit_path",
    "proven_attacker_control_or_not_required",
    "in_scope_asset",
    "direct_evidence"
  ],
  "caps": {
    "blocked_missing_attacker_control": "medium",
    "proven_partial_chain": "medium",
    "blocked_missing_auth_or_scope": "low",
    "theoretical_only": "low",
    "scanner_or_reference_only": "informational"
  }
}
`,
  "framework/auth-policy.json": `{
  "schema": "abdus-pentest-framework.auth-policy.v1",
  "reuse_valid_sessions_first": true,
  "signup_default": "do_not_attempt",
  "sticky_failures_default": "do_not_retry_until_reset",
  "auth_bound_testing_requires": [
    "valid_session",
    "explicit_operator_instruction",
    "or_lane_marked_blocked_auth"
  ],
  "session_artifact_roots": [
    "access/tokens",
    "browser/profiles",
    "browser/sessions"
  ]
}
`,
  "framework/auth-failures.json": `{
  "schema": "abdus-pentest-framework.auth-failures.v1",
  "failures": []
}
`,
  "framework/scope.md": `# APF Scope

## In Scope

- 

## Out Of Scope

- 

## Accounts And Auth

- 

## Intensity Limits

- 

## Notes

- 
`,
  "framework/status.md": `# APF Status

## Mode

Codex primary agent with optional bounded workstreams

## Current Focus

- 

## Candidates

- 

## Blockers

- 

## Next Exact Action

Read framework/state.json and continue from the next_actions list.
`,
  "framework/coverage.md": `# APF Coverage

| Lane | Status | Evidence | Next Action |
| --- | --- | --- | --- |
| scope | not_started |  |  |
| web_api | not_started |  |  |
| browser | not_started |  |  |
| mobile | not_started |  |  |
| repo | not_started |  |  |
| intel | not_started |  |  |
| auth | not_started |  |  |
`,
  "framework/search-ledger.jsonl": "",
  "framework/runners/README.md": `# APF Runners

Swarm runner artifacts live here.

Each swarm gets:
- index.json
- runner prompt files
- runner result files
- dispatch.sh
- workspaces/<runner-id>/

APF swarms use Codex workstreams. This directory stores runner prompt files, task assignment metadata, and result JSON files; it does not rely on OpenCode-only session tools.
`,
  "program/README.md": `# Program Dump

Drop raw pentest or bounty program details here, or put them in PROGRAM.md at the target root.

Accepted examples:
- program/*.md
- program/*.txt
- program/*.html
- program/*.json
- PROGRAM.md
- BOUNTY.md
- SCOPE_RAW.md

Then open Codex in the target directory and start from AGENTS.md.
`,
  "tools/README.md": `# Tool Runbooks

This directory documents practical tool use for the single APF AI.

Choose tools from evidence, MCPs, HackSkills, and local context. Use these runbooks as checklists for availability, help, safe use, stop conditions, and evidence.

Do not route by topic words. Do not treat a tool's presence as proof. Prefer the smallest bounded command that answers the current question.

## Discovery Pattern

\`\`\`bash
which <tool>
<tool> --help
node -e "console.log(require.resolve('<package>'))"
python3 - <<'PY'
import importlib.util
print(importlib.util.find_spec("package_name"))
PY
\`\`\`

## Runbooks

- tools/http.md
- tools/websocket.md
- tools/graphql.md
- tools/jwt.md
- tools/recon.md
- tools/content-discovery.md
- tools/scanner-validation.md
- tools/repo-secrets.md
- tools/screenshots.md
- tools/proxy.md
- tools/browser.md
- tools/mobile.md
`,
  "tools/http.md": `# HTTP / API

## When To Use

Use for bounded HTTP baselines, headers, auth-vs-unauth comparisons, method checks, and replay of known requests.

## Check Availability

\`\`\`bash
which curl
curl --version
which httpx
httpx -h
\`\`\`

## Common Patterns

\`\`\`bash
curl -i --max-time 20 'https://target.example/path'
curl -i -x http://127.0.0.1:18081 --max-time 20 'https://target.example/path'
\`\`\`

## Stop Conditions

- Scope or auth state is unclear.
- Required proxy/vantage is unavailable.
- Response indicates rate limiting or lockout risk.
- No boundary, object, state, or sensitive data difference is observed.

## Evidence

Record method, URL path, proxy/vantage, auth method, status, key headers, body summary, and artifact path.
`,
  "tools/websocket.md": `# WebSocket / Socket.IO

## When To Use

Use for raw WebSocket or Socket.IO handshake, namespace, origin, and event authorization checks.

## Check Availability

\`\`\`bash
which websocat
websocat --help
which wscat
wscat --help
node -e "console.log(require.resolve('ws'))"
node -e "console.log(require.resolve('socket.io-client'))"
\`\`\`

## Common Patterns

- Read bundles or captures first to identify concrete URLs, namespaces, and event names.
- For Socket.IO, prefer a tiny Node script using the local socket.io-client package when available.
- For raw WebSocket, use websocat, wscat, or a tiny Node ws script.

## Stop Conditions

- No concrete WebSocket URL or Socket.IO namespace evidence.
- Required auth method is blocked or stale.
- Required proxy/browser method is blocked_tooling.
- Only event names are found with no access-control boundary.
- Handshake is rate limited or blocked by WAF.

## Evidence

Record URL, namespace, transport, auth method, origin, proxy/vantage, handshake result, events emitted/listened to, and exact stop reason. Event names alone are context, not proof.
`,
  "tools/graphql.md": `# GraphQL

## When To Use

Use for known GraphQL endpoints, schema/introspection checks, resolver authz, batching, and object authorization.

## Check Availability

\`\`\`bash
which curl
curl --version
which clairvoyance
clairvoyance -h
which nuclei
nuclei -h
\`\`\`

## Stop Conditions

- Endpoint not confirmed.
- 429/rate limit or WAF blocks baseline.
- Auth/session required but unavailable for the intended method.
- No object, role, resolver, or sensitive field boundary exists.

## Evidence

Record endpoint, auth method, exact query class, status, error/body summary, rate-limit headers, and artifact path.
`,
  "tools/jwt.md": `# JWT / OAuth Tokens

## When To Use

Use when local artifacts contain replayable owned-account JWT/OAuth tokens and an accepting endpoint is known.

## Check Availability

\`\`\`bash
which jwt-tool
jwt-tool -h
python3 - <<'PY'
import json, base64
print('python jwt helpers available')
PY
\`\`\`

## Stop Conditions

- No local owned token artifact.
- No accepting endpoint.
- Token belongs to an out-of-scope host or account.
- Testing would require brute force or key guessing without explicit authorization.

## Evidence

Record token source artifact path, decoded header/claim summary, accepting endpoint, mutation attempted, status, and reason killed/blocked/promoted. Do not put raw token values in public summaries.
`,
  "tools/recon.md": `# Recon

## When To Use

Use for scoped asset discovery, DNS resolution, live host probing, URL gathering, crawling, port discovery, and technology fingerprinting.

## Check Availability

\`\`\`bash
which subfinder
subfinder -h
which amass
amass -h
which dnsx
dnsx -h
which shuffledns
shuffledns -h
which httpx
httpx -h
which naabu
naabu -h
which nmap
nmap --version
which gau
gau --help
which waybackurls
waybackurls -h
which katana
katana -h
which whatweb
whatweb --version
which wafw00f
wafw00f --help
\`\`\`

## Common Patterns

\`\`\`bash
subfinder -d target.example -silent | tee evidence/subdomains-passive.txt
amass enum -passive -d target.example -o evidence/amass-passive.txt
cat evidence/subdomains-passive.txt evidence/amass-passive.txt | sort -u | dnsx -silent -a -resp -o evidence/resolved-hosts.txt
cut -d' ' -f1 evidence/resolved-hosts.txt | httpx -silent -status-code -title -tech-detect -follow-redirects -o evidence/live-http.txt
cut -d' ' -f1 evidence/resolved-hosts.txt | naabu -top-ports 1000 -rate 1000 -o evidence/open-ports.txt
gau target.example | sort -u > evidence/gau-urls.txt
waybackurls target.example | sort -u > evidence/wayback-urls.txt
katana -list evidence/live-http.txt -d 2 -silent -o evidence/katana-urls.txt
\`\`\`

## Stop Conditions

- Program scope, asset ownership, or scan intensity is unclear.
- DNS brute force, port scanning, crawling, or archive enumeration is prohibited.
- Rate limits, WAF blocks, or unusual errors appear.
- The result does not expose a new boundary, endpoint class, auth surface, technology, or high-value target.
- You cannot explain why the next request is in scope.

## Evidence

Record scope source, command, wordlist or passive source, rate, resolver/proxy/vantage, output artifact, and why each promoted asset matters.
`,
  "tools/content-discovery.md": `# Content Discovery

## When To Use

Use only when scope, rate limits, and target value justify bounded path discovery.

## Check Availability

\`\`\`bash
which ffuf
ffuf -h
which gobuster
gobuster help
which dirsearch
dirsearch -h
\`\`\`

## Stop Conditions

- Program forbids scanning or path discovery.
- Rate limits, WAF, or account lockout risk appears.
- Existing route maps already cover the surface.
- Results are only generic 404/403/noise with no security boundary.

## Evidence

Record wordlist, rate, scope, proxy/vantage, discovered paths, status/body class, and why each path matters or was killed.
`,
  "tools/scanner-validation.md": `# Scanner Validation

## When To Use

Use when nuclei, sqlmap, nikto, wafw00f, dalfox, arjun, or other scanners can cheaply test a bounded hypothesis from recon or manual evidence.

## Check Availability

\`\`\`bash
which nuclei
nuclei -h
which sqlmap
sqlmap -hh
which nikto
nikto -H
which wafw00f
wafw00f --help
which dalfox
dalfox --help
which arjun
arjun -h
\`\`\`

## Common Patterns

\`\`\`bash
nuclei -u https://target.example -severity high,critical -rate-limit 5 -o evidence/nuclei-high-critical.txt
nuclei -l evidence/live-http.txt -tags exposure,misconfig,cve -severity medium,high,critical -rate-limit 5 -o evidence/nuclei-bounded.txt
arjun -u 'https://target.example/api/search' -oT evidence/arjun-search.txt
dalfox url 'https://target.example/search?q=test' --skip-bav --output evidence/dalfox-search.txt
sqlmap -u 'https://target.example/item?id=1' --batch --risk 1 --level 1 --output-dir evidence/sqlmap-item
nikto -host https://target.example -nointeractive -output evidence/nikto-target.txt
\`\`\`

## Validation Rules

- Search/read relevant nuclei templates before relying on a template match.
- Treat all scanner output as a hypothesis until target-specific evidence proves impact.
- Prefer single-host or single-endpoint runs over broad scans.
- Cap rate and severity; start with high/critical or a narrow tag set.
- Reproduce promising findings manually with curl, browser, or a minimal script.
- Kill findings that are version sightings, generic headers, missing flags, or unactionable hardening without high/critical impact.

## Stop Conditions

- Scope or auth state is unclear.
- The scan requires high volume, destructive payloads, credential guessing, or unsafe fuzzing.
- WAF/rate-limit/account-lockout signals appear.
- The scanner match cannot be tied to attacker control and target-specific impact.

## Evidence

Record exact command, template/tag set, rate, auth/proxy/vantage, raw output artifact, manual reproduction artifact, and final disposition.
`,
  "tools/repo-secrets.md": `# Repository And Secret Recon

## When To Use

Use for in-scope public repositories, provided source bundles, exposed VCS paths, CI artifacts, dependency manifests, and local operator-provided code.

## Check Availability

\`\`\`bash
which git
git --version
which trufflehog
trufflehog --help
which gitleaks
gitleaks --help
which rg
rg --version
\`\`\`

## Common Patterns

\`\`\`bash
trufflehog git https://github.com/org/repo --only-verified --json > evidence/trufflehog-repo.jsonl
gitleaks detect --source ./repo --no-banner --report-format json --report-path evidence/gitleaks-repo.json
rg -n --hidden -S 'api[_-]?key|secret|token|password|client_secret|PRIVATE KEY|BEGIN RSA' ./repo > evidence/secret-patterns.txt
curl -i --max-time 20 https://target.example/.git/config
curl -i --max-time 20 https://target.example/.env
\`\`\`

## Stop Conditions

- Repository, organization, package, or exposed file is not clearly in scope.
- Findings contain secrets from unrelated third parties or personal accounts.
- Validation would access data or systems outside authorization.
- Secret value is not needed for proof; do not print it in chat or public reports.
- The result is only a dependency/version sighting without exploitability or impact.

## Evidence

Record repo/source path, commit or artifact id, scanner command, redacted finding summary, validation boundary, and storage path for any raw secret under access/secrets or access/tokens.
`,
  "tools/screenshots.md": `# Screenshots And Visual Triage

## When To Use

Use for visual inspection of many scoped HTTP hosts, admin panels, login surfaces, default pages, exposed dashboards, screenshots for evidence, and browser-state proof.

## Check Availability

\`\`\`bash
which gowitness
gowitness --help
which eyewitness
eyewitness --help
which aquatone
aquatone -h
which google-chrome
google-chrome --version
which chromium
chromium --version
\`\`\`

## Common Patterns

\`\`\`bash
gowitness file -f evidence/live-http.txt --screenshot-path browser/captures/gowitness
gowitness report generate --destination browser/captures/gowitness/report.html
google-chrome --headless=new --disable-gpu --screenshot=browser/captures/target.png https://target.example/
chromium --headless=new --disable-gpu --screenshot=browser/captures/target.png https://target.example/
\`\`\`

## Stop Conditions

- The host list is not scoped or contains third-party infrastructure.
- Screenshots require authenticated browser state that is unavailable or stale.
- Large host lists would create unnecessary target load.
- Visual output shows only generic parking, CDN errors, or unrelated infrastructure.

## Evidence

Record input host list, screenshot tool, browser profile if authenticated, output directory, notable surfaces, and manual follow-up targets.
`,
  "tools/proxy.md": `# Proxy

## When To Use

Use for Burp, ZAP, mitmproxy, or target-egress proxy workflows where replay, interception, TLS behavior, or a specific network vantage matters.

## Check Availability

\`\`\`bash
which mitmproxy
mitmproxy --version
which mitmdump
mitmdump --version
which java
java -version
which curl
curl --version
\`\`\`

## Common Patterns

\`\`\`bash
curl -i -x http://127.0.0.1:8080 --max-time 20 https://target.example/
curl -i -x http://127.0.0.1:18081 --max-time 20 https://target.example/
mitmdump -p 8080 -w evidence/mitmproxy-flow.mitm
google-chrome --user-data-dir=browser/profiles/proxy-test --proxy-server=http://127.0.0.1:8080
\`\`\`

## Stop Conditions

- Proxy/vantage requirement is unclear.
- Proxy is not reachable or TLS interception is not trusted by the test browser/client.
- The flow requires OTP, manual consent, or credentials the operator has not provided.
- Target traffic would bypass the required proxy or VPN.
- Interception captures raw secrets that are not needed; store raw material only under access or browser artifacts.

## Evidence

Record proxy URL, tool profile, CA/trust state, auth method, request/response artifact, and whether traffic was confirmed to use the intended proxy.
`,
  "tools/browser.md": `# Browser / Chrome DevTools

## When To Use

Use when cookies, storage, screenshots, console, or browser network evidence matters.

## Check Availability

\`\`\`bash
which google-chrome
google-chrome --version
which chromium
chromium --version
\`\`\`

Use Chrome DevTools MCP or Playwright MCP when available for screenshots, console, storage, network, and page interaction. Use tools/proxy.md before browser work through a local proxy.

## Stop Conditions

- Required proxy or browser profile is unavailable.
- Auth flow is sticky-blocked.
- The user must provide OTP or manual sign-in.
- The same session has already been captured and is still valid for the intended method.

## Evidence

Record profile, browser URL, auth method, capture artifact paths, screenshot path if used, cookies/storage summary, and network summary.
`,
  "tools/mobile.md": `# Mobile

## When To Use

Use when APK/IPA, store listing, deeplinks, app links, mobile APIs, SDK markers, or mobile-only auth flows are in scope.

## Check Availability

\`\`\`bash
which adb
adb version
which apktool
apktool --help
which jadx
jadx --help
which frida
frida --version
which mobsfscan
mobsfscan --help
which apkeep
apkeep --help
\`\`\`

## Common Patterns

\`\`\`bash
apktool d app.apk -o evidence/mobile/apktool-app
jadx -d evidence/mobile/jadx-app app.apk
rg -n -S 'https?://|api[_-]?key|client_secret|deeplink|intent-filter|WebView|addJavascriptInterface' evidence/mobile
adb shell pm list packages | sort > evidence/mobile/packages.txt
frida-ps -Uai > evidence/mobile/frida-processes.txt
mobsfscan evidence/mobile/jadx-app --json > evidence/mobile/mobsfscan.json
\`\`\`

## Stop Conditions

- No scoped mobile artifact or store/app-link evidence.
- Device/emulator is locked or unavailable.
- SSL pinning/runtime work is needed but not explicitly assigned.
- Testing would leave owned-account or reversible boundaries.

## Evidence

Record package/app ID, artifact source, version, endpoints, deeplinks, exported components, auth method, and exact blocked/killed reason.
`,
  "access/session-registry.json": `{
  "schema": "abdus-pentest-framework.session-registry.v1",
  "notes": "Canonical reusable auth/session inventory. Auth is method-scoped: record curl/API proxy validity separately from browser/Playwright proxy validity. Use auth_record/auth_status instead of rediscovering signin state.",
  "sessions": []
}
`,
  "access/README.md": `# Access

This directory is for local owned-account operational material.

Keep working local credentials, token captures, browser sessions, and proxy config here when they are needed for the engagement. Raw values are valid workspace-local operator material; assistant-visible chat, public summaries, and reports should use artifact paths or summaries.
`,
  "access/secrets/README.md": `# Secrets

Store local credentials, proxy env files, and other operator-only inputs here.

APF operator mode allows tools and scripts to use these files as runtime inputs. Do not redact, delete, rotate, relocate, or rewrite them unless the user explicitly asks.
`,
  "access/tokens/README.md": `# Tokens

Store local cookies, tokens, storage dumps, and session captures here.

Raw values may live here for owned-account testing and may be reused by local tools/scripts. Assistant-visible chat, public summaries, and reports should use artifact paths or summaries.
`,
  "access/network/README.md": `# Network

Store workspace-local egress and VPN/vantage observations here.

Confirm the required network vantage before network-bound work when the operator wants Mullvad or a specific proxy. Public IP checks are explicit, not automatic.

Target-egress proxy mode is preferred for Mullvad-required target traffic:

- Start Codex on stable network, optionally outside the VPN-routed process tree.
- Start the local proxy separately and route that proxy through Mullvad.
- Point target tools at the proxy with -x or --proxy, usually http://127.0.0.1:18081.
- Point browser target traffic at the same proxy with --proxy-server=http://127.0.0.1:18081.
- Check proxy reachability before VPN-required target requests, for example with curl through the proxy.
- Check browser proxy behavior before browser/Playwright work through this proxy.
- Do not run mullvad connect/disconnect from agents or target scripts.
- If the proxy is unavailable, stop as blocked_proxy instead of direct testing.
`,
  "access/network/mullvad-proxy.env.example": `# Copy to access/network/mullvad-proxy.env if you want a custom URL.
# The proxy process itself must be launched outside the Codex process tree and routed through Mullvad.
APF_TARGET_PROXY_URL=http://127.0.0.1:18081
`,
  "findings/candidates/README.md": `# Candidates

Candidate files live here. A candidate is not a report.

Only create or keep active candidates that plausibly reach high/critical target impact. Informational, low, and medium observations are not accepted as standalone submissions; keep them as notes or chain components only when they support a high/critical path.
`,
  "findings/debates/README.md": `# Debates

Debate files live here. Every reportable candidate should be challenged before proof/report.

Debate must kill or demote informational, low, and medium standalone issues as non-reportable.
`,
  "evidence/README.md": `# Evidence

Store command output, browser captures, HARs, screenshots, request/response pairs, and proof artifacts here.
`,
  "reports/README.md": `# Reports

Only proven in-scope high/critical findings should become reports. Informational, low, and medium issues are not accepted as standalone reports.
`,
}
