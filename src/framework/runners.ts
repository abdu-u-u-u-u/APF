import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"

export type RunnerStatus = "prepared" | "running" | "completed" | "partial" | "blocked" | "error" | "cancelled"

export type RunnerSpec = {
  id: string
  role: string
  task: string
  lane?: string
  model?: string
}

export type SwarmRunnerRecord = RunnerSpec & {
  status: RunnerStatus
  prompt_file: string
  result_file: string
  task_command: string
  session_id?: string
  updated_at: string
}

export type SwarmIndex = {
  schema: "abdus-pentest-framework.swarm.v1"
  id: string
  goal: string
  created_at: string
  updated_at: string
  status: "prepared" | "running" | "completed" | "partial" | "blocked" | "cancelled"
  dispatch: {
    mode: "codex-workstream"
    agent: string
  }
  runners: SwarmRunnerRecord[]
}

export type RunnerResult = {
  schema: "abdus-pentest-framework.runner-result.v1"
  swarm_id: string
  runner_id: string
  status: Exclude<RunnerStatus, "prepared" | "running" | "cancelled">
  summary: string
  evidence: string[]
  findings: string[]
  blockers: string[]
  next_actions: string[]
  artifacts: string[]
  session_id?: string
  completed_at: string
}

export type SwarmStatusRunner = SwarmRunnerRecord & {
  result?: RunnerResult
}

export type SwarmStatus = Omit<SwarmIndex, "runners"> & {
  artifact_dir: string
  runners: SwarmStatusRunner[]
}

function now(): string {
  return new Date().toISOString()
}

function safeSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function rel(directory: string, file: string): string {
  return relative(directory, file) || "."
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return fallback
  }
}

export function swarmDirectory(directory: string, swarmId: string): string {
  return join(directory, "framework", "runners", swarmId)
}

export function swarmIndexPath(directory: string, swarmId: string): string {
  return join(swarmDirectory(directory, swarmId), "index.json")
}

export function listSwarmIds(directory: string): string[] {
  const root = join(directory, "framework", "runners")
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((entry) => {
      const path = join(root, entry)
      try {
        return statSync(path).isDirectory() && existsSync(join(path, "index.json"))
      } catch {
        return false
      }
    })
    .sort()
}

export function readSwarmIndex(directory: string, swarmId: string): SwarmIndex | undefined {
  const fallback = undefined as SwarmIndex | undefined
  const index = readJsonFile<SwarmIndex | undefined>(swarmIndexPath(directory, swarmId), fallback)
  return index?.schema === "abdus-pentest-framework.swarm.v1" ? index : undefined
}

function writeSwarmIndex(directory: string, index: SwarmIndex): void {
  writeJson(swarmIndexPath(directory, index.id), { ...index, updated_at: now() })
}

function runnerPrompt(input: {
  swarmId: string
  runner: RunnerSpec
  goal: string
  mainDirectory: string
  promptFile: string
  resultFile: string
}): string {
  return `# APF Codex Workstream Runner

Swarm: ${input.swarmId}
Runner: ${input.runner.id}
Role: ${input.runner.role}
Lane: ${input.runner.lane ?? "unspecified"}
Main APF root: ${input.mainDirectory}

## Swarm Goal

${input.goal}

## Assigned Task

${input.runner.task}

## Success Criteria

- Complete this assigned slice with target-specific evidence, or mark it blocked with a concrete blocker.
- Ground important claims in artifacts, tool output, or direct observations.
- Record final output by writing ${input.resultFile} with swarm_id=${input.swarmId} and runner_id=${input.runner.id}.

## Constraints

- Work only this assigned task and stay within documented authorization and scope.
- Do not print raw secrets, cookies, or tokens. Store raw operational material only under access/* or browser/*.
- Search results and scanner output are hypotheses, not proof.
- Do not spawn new swarms. Do not mark framework findings report_ready directly.

## Tool Rules

- Read framework/status.md, framework/state.json, framework/scope.md or SCOPE.md, and relevant program sources before target testing.
- For multi-step or tool-heavy work, begin with a one-line progress update stating the first step.
- Use local shell tooling, MCPs, and HackSkills when they materially improve correctness or completeness.
- Connect to configured MCPs with low-cost readiness checks before relying on that source: hacktricks, nuclei_templates, bughunter, cve_mcp, Chrome DevTools, Playwright, Nmap, or SQLMap.
- Use installed Codex skills when they materially improve correctness. If the right downstream skill is unclear, load hack first; otherwise load the most relevant router or topic skill.
- Before auth-bound work, inspect access/session-registry.json and related access/* artifacts directly; reuse valid recorded sessions before signin/signup.
- Before VPN/proxy-dependent target requests, inspect access/network/*, proxy/env.sh, and project notes directly. Do not bypass missing operator egress instructions.

## Expected Result Shape

Write ${input.resultFile} with:
- status: completed, partial, blocked, or error
- summary: compact evidence-backed result
- evidence/artifacts: workspace-relative paths
- findings: candidate ideas only, not report-ready claims
- blockers: concrete missing access/scope/tooling/proof
- next_actions: one to three exact next steps

## Stop Rules

- If missing context is retrievable with tools or local files, retrieve it before declaring the task blocked.
- If blocked, write the result file with a concrete blocker.
- After writing the result file, return a concise completion note to the parent agent.

Prompt artifact: ${input.promptFile}
Result artifact: ${input.resultFile}
`
}

function taskCommand(swarmId: string, runner: RunnerSpec): string {
  return `Run APF Codex swarm ${swarmId} workstream ${runner.id} from its prompt_file`
}

export function normalizeRunnerSpecs(input: {
  goal: string
  count?: number
  runners?: Array<Partial<RunnerSpec>>
  defaultModel?: string
}): RunnerSpec[] {
  const explicit = input.runners?.length ? input.runners : []
  const count = Math.max(1, Math.min(input.count ?? (explicit.length || 3), 24))
  const specs: RunnerSpec[] = []

  for (let index = 0; index < count; index += 1) {
    const provided = explicit[index] ?? {}
    const id = safeSegment(provided.id ?? `runner-${String(index + 1).padStart(3, "0")}`)
    specs.push({
      id,
      role: provided.role ?? `APF runner ${index + 1}`,
      task: provided.task ?? `Work one bounded, evidence-backed slice of this goal: ${input.goal}`,
      lane: provided.lane,
      model: provided.model ?? input.defaultModel,
    })
  }

  return specs
}

export function createSwarm(input: {
  directory: string
  goal: string
  swarmId?: string
  runners: RunnerSpec[]
  agent?: string
  dispatch?: boolean
}): SwarmIndex {
  const createdAt = now()
  const swarmId = safeSegment(input.swarmId ?? `swarm-${createdAt.replace(/[-:.]/g, "").replace("Z", "Z")}`)
  const swarmDir = swarmDirectory(input.directory, swarmId)
  mkdirSync(swarmDir, { recursive: true })

  const agent = input.agent ?? "codex"
  const records: SwarmRunnerRecord[] = []

  for (const runner of input.runners) {
    const promptPath = join(swarmDir, `${runner.id}.md`)
    const resultPath = join(swarmDir, `${runner.id}-result.json`)
    writeFileSync(
      promptPath,
      runnerPrompt({
        swarmId,
        runner,
        goal: input.goal,
        mainDirectory: input.directory,
        promptFile: rel(input.directory, promptPath),
        resultFile: rel(input.directory, resultPath),
      }),
    )

    records.push({
      ...runner,
      status: input.dispatch ? "running" : "prepared",
      prompt_file: rel(input.directory, promptPath),
      result_file: rel(input.directory, resultPath),
      task_command: taskCommand(swarmId, runner),
      updated_at: createdAt,
    })
  }

  const tasksFile = join(swarmDir, "tasks.md")
  writeFileSync(
    tasksFile,
    [
      `# APF Swarm ${swarmId}`,
      "",
      "Run each assignment as a bounded Codex workstream. Use parallel subagents if available; otherwise run them sequentially and preserve the same result-file contract.",
      "",
      ...records.flatMap((runner, index) => [
        `## ${index + 1}. ${runner.id}`,
        "",
        `Agent: ${agent}`,
        `Prompt: ${runner.prompt_file}`,
        `Task command: ${runner.task_command}`,
        "",
      ]),
    ].join("\n"),
  )

  const index: SwarmIndex = {
    schema: "abdus-pentest-framework.swarm.v1",
    id: swarmId,
    goal: input.goal,
    created_at: createdAt,
    updated_at: createdAt,
    status: input.dispatch ? "running" : "prepared",
    dispatch: {
      mode: "codex-workstream",
      agent,
    },
    runners: records,
  }

  writeSwarmIndex(input.directory, index)
  return readSwarmIndex(input.directory, swarmId) ?? index
}

export function dispatchSwarm(directory: string, swarmId: string): SwarmIndex | undefined {
  const index = readSwarmIndex(directory, swarmId)
  if (!index) return undefined

  const updated: SwarmIndex = {
    ...index,
    status: "running",
    dispatch: {
      ...index.dispatch,
      mode: "codex-workstream",
    },
    runners: index.runners.map((runner) =>
      runner.status === "prepared" ? { ...runner, status: "running", updated_at: now() } : runner,
    ),
  }
  writeSwarmIndex(directory, updated)
  return readSwarmIndex(directory, swarmId)
}

export function recordRunnerResult(directory: string, result: Omit<RunnerResult, "schema" | "completed_at">): RunnerResult {
  const completed: RunnerResult = {
    schema: "abdus-pentest-framework.runner-result.v1",
    ...result,
    completed_at: now(),
  }
  const swarmDir = swarmDirectory(directory, result.swarm_id)
  mkdirSync(swarmDir, { recursive: true })
  const file = join(swarmDir, `${safeSegment(result.runner_id)}-result.json`)
  writeJson(file, completed)

  const index = readSwarmIndex(directory, result.swarm_id)
  if (index) {
    index.runners = index.runners.map((runner) =>
      runner.id === result.runner_id
        ? {
            ...runner,
            status: result.status,
            session_id: result.session_id ?? runner.session_id,
            updated_at: completed.completed_at,
            result_file: rel(directory, file),
          }
        : runner,
    )
    const statuses = index.runners.map((runner) => runner.status)
    index.status = statuses.every((status) => status === "completed")
      ? "completed"
      : statuses.some((status) => status === "completed" || status === "partial")
        ? "partial"
        : statuses.some((status) => status === "blocked")
          ? "blocked"
          : index.status
    writeSwarmIndex(directory, index)
  }

  return completed
}

export function getSwarmStatus(directory: string, swarmId?: string): SwarmStatus[] {
  const ids = swarmId ? [swarmId] : listSwarmIds(directory)
  return ids
    .map((id) => readSwarmIndex(directory, id))
    .filter((index): index is SwarmIndex => Boolean(index))
    .map((index) => ({
      ...index,
      artifact_dir: rel(directory, swarmDirectory(directory, index.id)),
      runners: index.runners.map((runner) => {
        const result = readJsonFile<RunnerResult | undefined>(join(directory, runner.result_file), undefined)
        return {
          ...runner,
          result,
        }
      }),
    }))
}

export function cancelSwarm(directory: string, swarmId: string): SwarmIndex | undefined {
  const index = readSwarmIndex(directory, swarmId)
  if (!index) return undefined
  index.runners = index.runners.map((runner) => ({
    ...runner,
    status: runner.status === "completed" ? runner.status : "cancelled",
    updated_at: now(),
  }))
  index.status = "cancelled"
  writeSwarmIndex(directory, index)
  return readSwarmIndex(directory, swarmId)
}
