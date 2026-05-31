import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { delimiter, join } from "node:path"
import { execFileSync } from "node:child_process"
import { Socket } from "node:net"

export type NetworkStatusSummary = {
  present: boolean
  checked_at?: string
  mullvad_cli?: string
  mullvad_status?: string
  mullvad_connected?: boolean
  visible_location?: string
  public_check?: {
    checked_at: string
    endpoint: string
    ok: boolean
    data?: unknown
    error?: string
  }
  target_proxy?: NetworkProxySummary
  browser_proxy?: BrowserProxyProbeStatus
  artifact?: string
}

export type NetworkProxySummary = {
  checked_at?: string
  proxy_url: string
  source: "argument" | "environment" | "file" | "default"
  configured: boolean
  reachable?: boolean
  error?: string
  public_check?: NetworkStatusSummary["public_check"]
  notes: string[]
  artifact?: string
}

export type BrowserProxyProbeStatus = {
  checked_at?: string
  proxy_url?: string
  browser_proxy_usable?: boolean
  curl_proxy_usable?: boolean
  conclusion?: string
  browser_proxy_profile?: string
  recommended_browser_args?: string[]
  artifact?: string
}

const DEFAULT_TARGET_PROXY_URL = "http://127.0.0.1:18081"
const PROXY_ENV_KEYS = ["APF_TARGET_PROXY_URL", "MDASH_TARGET_PROXY_URL"] as const

export function networkArtifactPaths(directory: string): { latest: string; dir: string } {
  return {
    dir: join(directory, "access", "network"),
    latest: join(directory, "access", "network", "latest.json"),
  }
}

export function networkProxyArtifactPaths(directory: string): { latest: string; env: string; dir: string } {
  return {
    dir: join(directory, "access", "network"),
    env: join(directory, "access", "network", "mullvad-proxy.env"),
    latest: join(directory, "access", "network", "proxy-latest.json"),
  }
}

export function browserProxyProbeArtifactPath(directory: string): string {
  return join(directory, "access", "network", "browser-proxy-probe-latest.json")
}

function findExecutable(name: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, name)
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      continue
    }
  }
  return undefined
}

function run(command: string, args: string[], timeout = 3000): { ok: boolean; output?: string; error?: string } {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, {
        encoding: "utf8",
        timeout,
        maxBuffer: 64 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function parseVisibleLocation(status: string | undefined): string | undefined {
  return status
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith("visible location:"))
    ?.replace(/^visible location:\s*/i, "")
}

function publicMullvadCheck(proxyUrl?: string): NetworkStatusSummary["public_check"] {
  const endpoint = "https://am.i.mullvad.net/json"
  const curl = findExecutable("curl")
  if (!curl) {
    return {
      checked_at: new Date().toISOString(),
      endpoint,
      ok: false,
      error: "curl is not installed",
    }
  }
  const args = ["-fsS", "--max-time", "8"]
  if (proxyUrl) args.push("-x", proxyUrl)
  args.push(endpoint)
  const result = run(curl, args, 9000)
  if (!result.ok) {
    return {
      checked_at: new Date().toISOString(),
      endpoint,
      ok: false,
      error: result.error,
    }
  }
  try {
    return {
      checked_at: new Date().toISOString(),
      endpoint,
      ok: true,
      data: JSON.parse(result.output ?? "{}"),
    }
  } catch {
    return {
      checked_at: new Date().toISOString(),
      endpoint,
      ok: true,
      data: result.output,
    }
  }
}

function parseEnv(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    parsed[key] = rawValue.trim().replace(/^['"]|['"]$/g, "")
  }
  return parsed
}

function resolveProxyUrl(directory: string, explicit?: string): Pick<NetworkProxySummary, "proxy_url" | "source" | "configured"> {
  if (explicit?.trim()) {
    return { proxy_url: explicit.trim(), source: "argument", configured: true }
  }

  for (const key of PROXY_ENV_KEYS) {
    const value = process.env[key]
    if (value?.trim()) return { proxy_url: value.trim(), source: "environment", configured: true }
  }

  const envFile = networkProxyArtifactPaths(directory).env
  if (existsSync(envFile)) {
    const parsed = parseEnv(readFileSync(envFile, "utf8"))
    for (const key of PROXY_ENV_KEYS) {
      const value = parsed[key]
      if (value?.trim()) return { proxy_url: value.trim(), source: "file", configured: true }
    }
  }

  return { proxy_url: DEFAULT_TARGET_PROXY_URL, source: "default", configured: false }
}

function proxyHostPort(proxyUrl: string): { host: string; port: number } {
  const parsed = new URL(proxyUrl)
  const port =
    Number(parsed.port) ||
    (parsed.protocol === "https:" ? 443 : parsed.protocol.startsWith("socks") ? 1080 : 80)
  return { host: parsed.hostname, port }
}

function checkTcpReachable(proxyUrl: string, timeout = 1200): Promise<{ reachable: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = new Socket()
    let settled = false

    const finish = (result: { reachable: boolean; error?: string }) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    let endpoint: { host: string; port: number }
    try {
      endpoint = proxyHostPort(proxyUrl)
    } catch (error) {
      finish({ reachable: false, error: error instanceof Error ? error.message : String(error) })
      return
    }

    socket.setTimeout(timeout)
    socket.once("connect", () => finish({ reachable: true }))
    socket.once("timeout", () => finish({ reachable: false, error: `timeout connecting to ${endpoint.host}:${endpoint.port}` }))
    socket.once("error", (error) => finish({ reachable: false, error: error.message }))
    socket.connect(endpoint.port, endpoint.host)
  })
}

export async function collectProxyStatus(
  directory: string,
  options: { record?: boolean; public_check?: boolean; proxy_url?: string } = {},
): Promise<NetworkProxySummary> {
  const resolved = resolveProxyUrl(directory, options.proxy_url)
  const reachable = await checkTcpReachable(resolved.proxy_url)
  const summary: NetworkProxySummary = {
    checked_at: new Date().toISOString(),
    ...resolved,
    reachable: reachable.reachable,
    error: reachable.error,
    public_check: options.public_check ? publicMullvadCheck(resolved.proxy_url) : undefined,
    notes: [
      "This proxy is the preferred target-egress path for VPN-required curl/browser work.",
      "The proxy process must be started outside the Codex process tree and routed through Mullvad.",
      "Do not run mullvad connect/disconnect from agents; if this proxy is unavailable, mark blocked_proxy.",
    ],
  }

  if (options.record ?? true) {
    const paths = networkProxyArtifactPaths(directory)
    mkdirSync(paths.dir, { recursive: true })
    writeFileSync(paths.latest, `${JSON.stringify(summary, null, 2)}\n`)
    summary.artifact = "access/network/proxy-latest.json"
  }

  return summary
}

export function collectNetworkStatus(directory: string, options: { record?: boolean; public_check?: boolean } = {}): NetworkStatusSummary {
  const mullvad = findExecutable("mullvad")
  const status = mullvad ? run(mullvad, ["status"]) : { ok: false, error: "mullvad CLI is not installed" }
  const statusText = status.output ?? status.error ?? ""
  const summary: NetworkStatusSummary = {
    present: Boolean(mullvad),
    checked_at: new Date().toISOString(),
    mullvad_cli: mullvad,
    mullvad_status: statusText,
    mullvad_connected: /^connected\b/i.test(statusText),
    visible_location: parseVisibleLocation(statusText),
    public_check: options.public_check ? publicMullvadCheck() : undefined,
    target_proxy: summarizeProxyStatus(directory),
    browser_proxy: summarizeBrowserProxyStatus(directory),
  }

  if (options.record ?? true) {
    const paths = networkArtifactPaths(directory)
    mkdirSync(paths.dir, { recursive: true })
    writeFileSync(paths.latest, `${JSON.stringify(summary, null, 2)}\n`)
    summary.artifact = "access/network/latest.json"
  }

  return summary
}

export function summarizeProxyStatus(directory: string): NetworkProxySummary | undefined {
  const paths = networkProxyArtifactPaths(directory)
  if (!existsSync(paths.latest)) return undefined
  try {
    const summary = JSON.parse(readFileSync(paths.latest, "utf8")) as NetworkProxySummary
    return {
      ...summary,
      artifact: "access/network/proxy-latest.json",
    }
  } catch {
    return undefined
  }
}

export function summarizeBrowserProxyStatus(directory: string): BrowserProxyProbeStatus | undefined {
  const path = browserProxyProbeArtifactPath(directory)
  if (!existsSync(path)) return undefined
  try {
    const summary = JSON.parse(readFileSync(path, "utf8")) as BrowserProxyProbeStatus
    return {
      checked_at: summary.checked_at,
      proxy_url: summary.proxy_url,
      browser_proxy_usable: summary.browser_proxy_usable,
      curl_proxy_usable: summary.curl_proxy_usable,
      conclusion: summary.conclusion,
      browser_proxy_profile: summary.browser_proxy_profile,
      recommended_browser_args: summary.recommended_browser_args,
      artifact: "access/network/browser-proxy-probe-latest.json",
    }
  } catch {
    return undefined
  }
}

export function summarizeNetworkStatus(directory: string): NetworkStatusSummary {
  const paths = networkArtifactPaths(directory)
  if (!existsSync(paths.latest)) {
    return { present: false, artifact: "access/network/latest.json", target_proxy: summarizeProxyStatus(directory) }
  }
  try {
    const summary = JSON.parse(readFileSync(paths.latest, "utf8")) as NetworkStatusSummary
    return {
      ...summary,
      target_proxy: summarizeProxyStatus(directory) ?? summary.target_proxy,
      browser_proxy: summarizeBrowserProxyStatus(directory) ?? summary.browser_proxy,
      artifact: "access/network/latest.json",
    }
  } catch {
    return {
      present: false,
      artifact: "access/network/latest.json",
      target_proxy: summarizeProxyStatus(directory),
      browser_proxy: summarizeBrowserProxyStatus(directory),
    }
  }
}

export function formatNetworkStatus(summary: NetworkStatusSummary): string[] {
  const proxy = summary.target_proxy
  const browserProxy = summary.browser_proxy
  if (!summary.checked_at) {
    return [
      "- no recorded network status; call network_status",
      proxy
        ? `- target_proxy: ${proxy.proxy_url} reachable=${proxy.reachable ?? false} artifact=${proxy.artifact ?? "access/network/proxy-latest.json"}`
        : "- target_proxy: no recorded proxy status; call proxy_status when Mullvad egress proxy is required",
      browserProxy
        ? `- browser_proxy: usable=${browserProxy.browser_proxy_usable ?? false} conclusion=${browserProxy.conclusion ?? "unknown"} profile=${browserProxy.browser_proxy_profile ?? "default"} artifact=${browserProxy.artifact ?? "access/network/browser-proxy-probe-latest.json"}`
        : "- browser_proxy: no recorded browser proxy probe; call browser_proxy_probe before browser work through a local proxy",
    ]
  }
  const lines = [
    `- checked_at: ${summary.checked_at}`,
    `- mullvad_cli: ${summary.mullvad_cli ?? "missing"}`,
    `- mullvad_connected: ${summary.mullvad_connected ?? false}`,
    `- visible_location: ${summary.visible_location ?? "unknown"}`,
    `- public_check: ${summary.public_check ? `${summary.public_check.ok ? "ok" : "failed"} ${summary.public_check.endpoint}` : "not requested"}`,
    `- artifact: ${summary.artifact ?? "access/network/latest.json"}`,
  ]
  lines.push(
    proxy
      ? `- target_proxy: ${proxy.proxy_url} reachable=${proxy.reachable ?? false} public_check=${proxy.public_check ? (proxy.public_check.ok ? "ok" : "failed") : "not requested"} artifact=${proxy.artifact ?? "access/network/proxy-latest.json"}`
      : "- target_proxy: no recorded proxy status; call proxy_status when Mullvad egress proxy is required",
  )
  lines.push(
    browserProxy
      ? `- browser_proxy: usable=${browserProxy.browser_proxy_usable ?? false} curl_usable=${browserProxy.curl_proxy_usable ?? false} conclusion=${browserProxy.conclusion ?? "unknown"} profile=${browserProxy.browser_proxy_profile ?? "default"} args=${browserProxy.recommended_browser_args?.join(" ") ?? "default"} artifact=${browserProxy.artifact ?? "access/network/browser-proxy-probe-latest.json"}`
      : "- browser_proxy: no recorded browser proxy probe; call browser_proxy_probe before browser work through a local proxy",
  )
  return lines
}
