type JsonRpcId = string | number | null

type JsonRpcMessage = {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: unknown
}

type McpToolResult = {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export type McpToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

type McpServerOptions = {
  name: string
  version: string
  tools: McpToolDefinition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toToolResult(value: unknown, isError = false): McpToolResult {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) }
}

function writeJson(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function result(id: JsonRpcId | undefined, value: unknown): void {
  if (id === undefined) return
  writeJson({ jsonrpc: "2.0", id, result: value })
}

function error(id: JsonRpcId | undefined, code: number, message: string): void {
  if (id === undefined) return
  writeJson({ jsonrpc: "2.0", id, error: { code, message } })
}

function parseContentLengthFrames(buffer: string): { messages: string[]; rest: string } | null {
  if (!buffer.startsWith("Content-Length:")) return null
  const messages: string[] = []
  let rest = buffer
  while (rest.startsWith("Content-Length:")) {
    const headerEnd = rest.indexOf("\r\n\r\n")
    if (headerEnd < 0) break
    const header = rest.slice(0, headerEnd)
    const match = header.match(/Content-Length:\s*(\d+)/i)
    if (!match) break
    const length = Number(match[1])
    const bodyStart = headerEnd + 4
    const bodyEnd = bodyStart + length
    if (rest.length < bodyEnd) break
    messages.push(rest.slice(bodyStart, bodyEnd))
    rest = rest.slice(bodyEnd)
  }
  return { messages, rest }
}

function parseLineFrames(buffer: string): { messages: string[]; rest: string } {
  const lines = buffer.split(/\n/)
  const rest = lines.pop() ?? ""
  return { messages: lines.map((line) => line.trim()).filter(Boolean), rest }
}

function parseMessages(buffer: string): { messages: JsonRpcMessage[]; rest: string } {
  const framed = parseContentLengthFrames(buffer)
  const parsed = framed ?? parseLineFrames(buffer)
  const messages: JsonRpcMessage[] = []
  for (const raw of parsed.messages) {
    try {
      const message = JSON.parse(raw)
      if (isRecord(message)) messages.push(message)
    } catch (parseError) {
      writeJson({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: parseError instanceof Error ? parseError.message : "Parse error" },
      })
    }
  }
  return { messages, rest: parsed.rest }
}

export function startMcpServer(options: McpServerOptions): void {
  const tools = new Map(options.tools.map((tool) => [tool.name, tool]))
  let buffer = ""

  async function handle(message: JsonRpcMessage): Promise<void> {
    const id = message.id
    const method = message.method
    if (!method) {
      error(id, -32600, "Invalid request: missing method")
      return
    }

    if (method === "initialize") {
      result(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
        serverInfo: { name: options.name, version: options.version },
      })
      return
    }

    if (method === "notifications/initialized") return

    if (method === "ping") {
      result(id, {})
      return
    }

    if (method === "tools/list") {
      result(id, {
        tools: [...tools.values()].map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      })
      return
    }

    if (method === "tools/call") {
      const params = isRecord(message.params) ? message.params : {}
      const name = typeof params.name === "string" ? params.name : ""
      const tool = tools.get(name)
      if (!tool) {
        result(id, toToolResult(`Unknown tool: ${name}`, true))
        return
      }
      const args = isRecord(params.arguments) ? params.arguments : {}
      try {
        result(id, toToolResult(await tool.execute(args)))
      } catch (toolError) {
        const messageText = toolError instanceof Error ? toolError.message : String(toolError)
        result(id, toToolResult(`Error: ${messageText}`, true))
      }
      return
    }

    if (method === "resources/list") {
      result(id, { resources: [] })
      return
    }

    if (method === "prompts/list") {
      result(id, { prompts: [] })
      return
    }

    error(id, -32601, `Method not found: ${method}`)
  }

  process.stdin.setEncoding("utf8")
  process.stdin.on("data", (chunk) => {
    buffer += chunk
    const parsed = parseMessages(buffer)
    buffer = parsed.rest
    for (const message of parsed.messages) {
      void handle(message)
    }
  })
}
