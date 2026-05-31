import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { delimiter, join } from "node:path"
import { execFileSync, spawn, type ChildProcess } from "node:child_process"
import { tmpdir } from "node:os"
import { networkProxyArtifactPaths } from "./network"

export type BrowserProxyProbeOptions = {
  proxy_url: string
  target_url?: string
  browser_path?: string
  timeout_ms?: number
  public_check?: boolean
  curl_check?: boolean
  direct_check?: boolean
  record?: boolean
}

export type CurlProbeResult = {
  ok: boolean
  url: string
  proxy_url?: string
  status?: number
  bytes?: number
  duration_ms: number
  body_sha256?: string
  error?: string
}

export type ChromeProbeResult = {
  ok: boolean
  url: string
  proxy_url?: string
  profile?: "default" | "tls12_fallback"
  browser_path?: string
  status?: number
  response_url?: string
  duration_ms: number
  error?: string
  loading_error?: string
  response_count: number
  responses: Array<{
    url: string
    status?: number
    type?: string
  }>
}

export type BrowserProxyProbeSummary = {
  checked_at: string
  proxy_url: string
  target_url?: string
  public_check_url?: string
  timeout_ms: number
  browser_path?: string
  curl_proxy_public?: CurlProbeResult
  curl_proxy_target?: CurlProbeResult
  chrome_direct_target?: ChromeProbeResult
  chrome_proxy_public?: ChromeProbeResult
  chrome_proxy_target?: ChromeProbeResult
  chrome_proxy_public_tls12?: ChromeProbeResult
  chrome_proxy_target_tls12?: ChromeProbeResult
  browser_proxy_usable: boolean
  curl_proxy_usable: boolean
  conclusion: "usable" | "curl_only" | "blocked_browser_proxy" | "blocked_proxy" | "not_tested"
  browser_proxy_profile?: "default" | "tls12_fallback"
  recommended_browser_args?: string[]
  notes: string[]
  artifact?: string
}

const DEFAULT_PUBLIC_CHECK_URL = "https://am.i.mullvad.net/json"
const DEFAULT_TIMEOUT_MS = 15000

function clampTimeout(timeout: number | undefined): number {
  return Math.max(3000, Math.min(timeout ?? DEFAULT_TIMEOUT_MS, 45000))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function findExecutable(candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      try {
        accessSync(candidate, constants.X_OK)
        return candidate
      } catch {
        continue
      }
    }
    for (const dir of (process.env.PATH ?? "").split(delimiter)) {
      if (!dir) continue
      const path = join(dir, candidate)
      try {
        accessSync(path, constants.X_OK)
        return path
      } catch {
        continue
      }
    }
  }
  return undefined
}

function chromePath(explicit?: string): string | undefined {
  if (explicit?.trim()) return findExecutable([explicit.trim()])
  if (process.env.CHROME_PATH?.trim()) return findExecutable([process.env.CHROME_PATH.trim()])
  return findExecutable(["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"])
}

function curlPath(): string | undefined {
  return findExecutable(["curl"])
}

function sha256File(path: string): string | undefined {
  const sha = findExecutable(["sha256sum"])
  if (!sha) return undefined
  try {
    return execFileSync(sha, [path], { encoding: "utf8", timeout: 2000 }).trim().split(/\s+/)[0]
  } catch {
    return undefined
  }
}

function curlProbe(url: string, proxyUrl: string | undefined, timeoutMs: number): CurlProbeResult {
  const curl = curlPath()
  const started = Date.now()
  if (!curl) {
    return { ok: false, url, proxy_url: proxyUrl, duration_ms: Date.now() - started, error: "curl is not installed" }
  }
  const bodyFile = join(tmpdir(), `apf-curl-probe-${Date.now()}-${Math.random().toString(16).slice(2)}.body`)
  const args = ["-sS", "-L", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-o", bodyFile, "-w", "%{http_code} %{size_download}", url]
  if (proxyUrl) args.splice(args.length - 1, 0, "-x", proxyUrl)
  try {
    const output = execFileSync(curl, args, {
      encoding: "utf8",
      timeout: timeoutMs + 1500,
      maxBuffer: 32 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
    const [statusRaw, bytesRaw] = output.split(/\s+/)
    const status = Number(statusRaw)
    const bytes = Number(bytesRaw)
    return {
      ok: Number.isFinite(status) && status > 0,
      url,
      proxy_url: proxyUrl,
      status: Number.isFinite(status) ? status : undefined,
      bytes: Number.isFinite(bytes) ? bytes : undefined,
      duration_ms: Date.now() - started,
      body_sha256: existsSync(bodyFile) ? sha256File(bodyFile) : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      url,
      proxy_url: proxyUrl,
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    rmSync(bodyFile, { force: true })
  }
}

type CdpSession = {
  call(method: string, params?: Record<string, unknown>): Promise<unknown>
  close(): void
}

function createCdpSession(wsUrl: string, onEvent: (method: string, params: Record<string, unknown>) => void): Promise<CdpSession> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let nextId = 1
    let settled = false
    const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>()
    const openTimer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`Could not connect to ${wsUrl}`))
    }, 8000)

    ws.addEventListener("open", () => {
      if (settled) return
      settled = true
      clearTimeout(openTimer)
      resolve({
        call(method, params) {
          return new Promise((callResolve, callReject) => {
            const id = nextId++
            const timer = setTimeout(() => {
              pending.delete(id)
              callReject(new Error(`CDP ${method} timed out`))
            }, 8000)
            pending.set(id, { resolve: callResolve, reject: callReject, timer })
            ws.send(JSON.stringify({ id, method, params: params ?? {} }))
          })
        },
        close() {
          for (const item of pending.values()) clearTimeout(item.timer)
          pending.clear()
          try {
            ws.close()
          } catch {
            // ignore close failure
          }
        },
      })
    })

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number
        method?: string
        params?: Record<string, unknown>
        result?: unknown
        error?: { message?: string }
      }
      if (message.method) {
        onEvent(message.method, message.params ?? {})
        return
      }
      if (typeof message.id !== "number") return
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      clearTimeout(item.timer)
      if (message.error) item.reject(new Error(message.error.message ?? "CDP call failed"))
      else item.resolve(message.result)
    })

    ws.addEventListener("error", () => {
      if (!settled) {
        settled = true
        clearTimeout(openTimer)
        reject(new Error(`Could not connect to ${wsUrl}`))
      }
    })
  })
}

async function waitForDevTools(profileDir: string, child: ChildProcess, timeoutMs: number): Promise<string> {
  const file = join(profileDir, "DevToolsActivePort")
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Chrome exited early with code ${child.exitCode}`)
    if (existsSync(file)) {
      const [port, wsPath] = readFileSync(file, "utf8").trim().split(/\r?\n/)
      if (port) return `http://127.0.0.1:${port}${wsPath ? "" : ""}`
    }
    await sleep(100)
  }
  throw new Error("Chrome did not expose DevToolsActivePort before timeout")
}

async function newCdpPage(browserBaseUrl: string, url = "about:blank"): Promise<{ webSocketDebuggerUrl: string }> {
  const endpoint = `${browserBaseUrl}/json/new?${encodeURIComponent(url)}`
  const response = await fetch(endpoint, { method: "PUT" })
  if (!response.ok) throw new Error(`CDP new page failed: ${response.status} ${response.statusText}`)
  const page = (await response.json()) as { webSocketDebuggerUrl?: string }
  if (!page.webSocketDebuggerUrl) throw new Error("CDP new page did not return webSocketDebuggerUrl")
  return { webSocketDebuggerUrl: page.webSocketDebuggerUrl }
}

function responseEvent(params: Record<string, unknown>): { url: string; status?: number; type?: string } | undefined {
  const response = params.response
  if (typeof response !== "object" || response === null) return undefined
  const record = response as Record<string, unknown>
  const url = typeof record.url === "string" ? record.url : undefined
  if (!url) return undefined
  const status = typeof record.status === "number" ? record.status : undefined
  const type = typeof params.type === "string" ? params.type : undefined
  return { url, status, type }
}

function loadingError(params: Record<string, unknown>): string | undefined {
  return typeof params.errorText === "string" ? params.errorText : undefined
}

async function terminateChrome(child: ChildProcess): Promise<void> {
  if (!child.pid) return
  try {
    process.kill(-child.pid, "SIGTERM")
  } catch {
    try {
      child.kill("SIGTERM")
    } catch {
      // ignore
    }
  }
  await sleep(400)
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL")
    } catch {
      try {
        child.kill("SIGKILL")
      } catch {
        // ignore
      }
    }
  }
}

async function chromeProbe(args: {
  url: string
  proxyUrl?: string
  browserPath: string
  timeoutMs: number
  profile?: "default" | "tls12_fallback"
  extraChromeArgs?: string[]
}): Promise<ChromeProbeResult> {
  const started = Date.now()
  const profileDir = mkdtempSync(join(tmpdir(), "apf-browser-probe-"))
  let child: ChildProcess | undefined
  let session: CdpSession | undefined
  const responses: ChromeProbeResult["responses"] = []
  let loadError: string | undefined

  try {
    const chromeArgs = [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-client-side-phishing-detection",
      "--disable-default-apps",
      "--disable-dns-prefetch",
      "--disable-extensions",
      "--disable-features=HttpsUpgrades,OptimizationHints,Translate,MediaRouter",
      "--disable-quic",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-default-browser-check",
      "--no-first-run",
      "--password-store=basic",
      `--user-data-dir=${profileDir}`,
      "--remote-debugging-port=0",
      ...(args.extraChromeArgs ?? []),
      "about:blank",
    ]
    if (args.proxyUrl) chromeArgs.splice(chromeArgs.length - 1, 0, `--proxy-server=${args.proxyUrl}`, "--proxy-bypass-list=<-loopback>")

    child = spawn(args.browserPath, chromeArgs, {
      detached: true,
      stdio: "ignore",
    })

    const browserBaseUrl = await waitForDevTools(profileDir, child, Math.min(args.timeoutMs, 10000))
    const page = await newCdpPage(browserBaseUrl)
    session = await createCdpSession(page.webSocketDebuggerUrl, (method, params) => {
      if (method === "Network.responseReceived") {
        const event = responseEvent(params)
        if (event) responses.push(event)
      }
      if (method === "Network.loadingFailed") {
        loadError = loadingError(params) ?? loadError
      }
    })
    await session.call("Network.enable")
    await session.call("Page.enable")
    await session.call("Page.navigate", { url: args.url })

    const deadline = Date.now() + args.timeoutMs
    while (Date.now() < deadline) {
      const documentResponse = responses.find((response) => response.type === "Document")
      if (documentResponse) {
        return {
          ok: true,
          url: args.url,
          proxy_url: args.proxyUrl,
          profile: args.profile ?? "default",
          browser_path: args.browserPath,
          status: documentResponse.status,
          response_url: documentResponse.url,
          duration_ms: Date.now() - started,
          response_count: responses.length,
          responses: responses.slice(0, 12),
        }
      }
      if (loadError) break
      await sleep(100)
    }

    return {
      ok: false,
      url: args.url,
      proxy_url: args.proxyUrl,
      profile: args.profile ?? "default",
      browser_path: args.browserPath,
      duration_ms: Date.now() - started,
      error: loadError ? `Chrome loading failed: ${loadError}` : "Timed out before a document response was observed",
      loading_error: loadError,
      response_count: responses.length,
      responses: responses.slice(0, 12),
    }
  } catch (error) {
    return {
      ok: false,
      url: args.url,
      proxy_url: args.proxyUrl,
      profile: args.profile ?? "default",
      browser_path: args.browserPath,
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      response_count: responses.length,
      responses: responses.slice(0, 12),
    }
  } finally {
    session?.close()
    if (child) await terminateChrome(child)
    rmSync(profileDir, { recursive: true, force: true })
  }
}

function effectiveChromeResult(defaultResult?: ChromeProbeResult, tls12Result?: ChromeProbeResult): ChromeProbeResult | undefined {
  if (defaultResult?.ok) return defaultResult
  if (tls12Result?.ok) return tls12Result
  return defaultResult ?? tls12Result
}

function computeConclusion(summary: Omit<BrowserProxyProbeSummary, "browser_proxy_usable" | "curl_proxy_usable" | "conclusion" | "notes">): Pick<
  BrowserProxyProbeSummary,
  "browser_proxy_usable" | "curl_proxy_usable" | "conclusion" | "browser_proxy_profile" | "recommended_browser_args" | "notes"
> {
  const curlResults = [summary.curl_proxy_public, summary.curl_proxy_target].filter((item): item is CurlProbeResult => Boolean(item))
  const chromeProxyResults = [
    effectiveChromeResult(summary.chrome_proxy_public, summary.chrome_proxy_public_tls12),
    effectiveChromeResult(summary.chrome_proxy_target, summary.chrome_proxy_target_tls12),
  ].filter((item): item is ChromeProbeResult => Boolean(item))
  const curlProxyUsable = curlResults.length > 0 && curlResults.every((item) => item.ok)
  const browserProxyUsable = chromeProxyResults.length > 0 && chromeProxyResults.every((item) => item.ok)
  const browserProxyProfile = browserProxyUsable
    ? chromeProxyResults.some((item) => item.profile === "tls12_fallback")
      ? "tls12_fallback"
      : "default"
    : undefined
  const recommendedBrowserArgs =
    browserProxyProfile === "tls12_fallback"
      ? [`--proxy-server=${summary.proxy_url}`, "--proxy-bypass-list=<-loopback>", "--ssl-version-max=tls1.2", "--disable-quic"]
      : undefined

  let conclusion: BrowserProxyProbeSummary["conclusion"] = "not_tested"
  if (browserProxyUsable) conclusion = "usable"
  else if (curlProxyUsable && chromeProxyResults.length > 0) conclusion = "curl_only"
  else if (chromeProxyResults.length > 0) conclusion = "blocked_browser_proxy"
  else if (curlResults.length > 0 && !curlProxyUsable) conclusion = "blocked_proxy"

  const notes = [
    "Auth and network capability are method-scoped; a curl-valid session does not imply browser-valid transport.",
    "If conclusion is curl_only, proceed with curl/API assignments only and mark browser-dependent testing blocked_tooling until this probe passes.",
    "If browser_proxy_profile is tls12_fallback, browser/Playwright jobs using this local proxy must pass --ssl-version-max=tls1.2 to Chrome.",
    "This probe launches a temporary Chrome profile and kills only its own process group on completion.",
  ]
  return {
    browser_proxy_usable: browserProxyUsable,
    curl_proxy_usable: curlProxyUsable,
    conclusion,
    browser_proxy_profile: browserProxyProfile,
    recommended_browser_args: recommendedBrowserArgs,
    notes,
  }
}

export async function runBrowserProxyProbe(directory: string, options: BrowserProxyProbeOptions): Promise<BrowserProxyProbeSummary> {
  const timeoutMs = clampTimeout(options.timeout_ms)
  const publicCheck = options.public_check ?? true
  const curlCheck = options.curl_check ?? true
  const browser = chromePath(options.browser_path)
  const base = {
    checked_at: new Date().toISOString(),
    proxy_url: options.proxy_url,
    target_url: options.target_url,
    public_check_url: publicCheck ? DEFAULT_PUBLIC_CHECK_URL : undefined,
    timeout_ms: timeoutMs,
    browser_path: browser,
  }

  const curlProxyPublic = publicCheck && curlCheck ? curlProbe(DEFAULT_PUBLIC_CHECK_URL, options.proxy_url, timeoutMs) : undefined
  const curlProxyTarget = options.target_url && curlCheck ? curlProbe(options.target_url, options.proxy_url, timeoutMs) : undefined
  const chromeDirectTarget =
    options.target_url && options.direct_check && browser
      ? await chromeProbe({ url: options.target_url, browserPath: browser, timeoutMs })
      : undefined
  const chromeProxyPublic =
    publicCheck && browser ? await chromeProbe({ url: DEFAULT_PUBLIC_CHECK_URL, proxyUrl: options.proxy_url, browserPath: browser, timeoutMs }) : undefined
  const chromeProxyTarget =
    options.target_url && browser
      ? await chromeProbe({ url: options.target_url, proxyUrl: options.proxy_url, browserPath: browser, timeoutMs })
      : undefined
  const chromeProxyPublicTls12 =
    publicCheck && browser && chromeProxyPublic && !chromeProxyPublic.ok
      ? await chromeProbe({
          url: DEFAULT_PUBLIC_CHECK_URL,
          proxyUrl: options.proxy_url,
          browserPath: browser,
          timeoutMs,
          profile: "tls12_fallback",
          extraChromeArgs: ["--ssl-version-max=tls1.2"],
        })
      : undefined
  const chromeProxyTargetTls12 =
    options.target_url && browser && chromeProxyTarget && !chromeProxyTarget.ok
      ? await chromeProbe({
          url: options.target_url,
          proxyUrl: options.proxy_url,
          browserPath: browser,
          timeoutMs,
          profile: "tls12_fallback",
          extraChromeArgs: ["--ssl-version-max=tls1.2"],
        })
      : undefined

  const computed = computeConclusion({
    ...base,
    curl_proxy_public: curlProxyPublic,
    curl_proxy_target: curlProxyTarget,
    chrome_direct_target: chromeDirectTarget,
    chrome_proxy_public: chromeProxyPublic,
    chrome_proxy_target: chromeProxyTarget,
    chrome_proxy_public_tls12: chromeProxyPublicTls12,
    chrome_proxy_target_tls12: chromeProxyTargetTls12,
  })
  const summary: BrowserProxyProbeSummary = {
    ...base,
    curl_proxy_public: curlProxyPublic,
    curl_proxy_target: curlProxyTarget,
    chrome_direct_target: chromeDirectTarget,
    chrome_proxy_public: chromeProxyPublic,
    chrome_proxy_target: chromeProxyTarget,
    chrome_proxy_public_tls12: chromeProxyPublicTls12,
    chrome_proxy_target_tls12: chromeProxyTargetTls12,
    ...computed,
    notes: browser ? computed.notes : ["Chrome executable not found.", ...computed.notes],
  }

  if (options.record ?? true) {
    const paths = networkProxyArtifactPaths(directory)
    mkdirSync(paths.dir, { recursive: true })
    const artifact = join(paths.dir, "browser-proxy-probe-latest.json")
    writeFileSync(artifact, `${JSON.stringify(summary, null, 2)}\n`)
    summary.artifact = "access/network/browser-proxy-probe-latest.json"
  }

  return summary
}
