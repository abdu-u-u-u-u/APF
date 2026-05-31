import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { initializeFrameworkWorkspace, summarizeFrameworkStatus } from "./artifacts"
import { createSwarm, getSwarmStatus, normalizeRunnerSpecs } from "./runners"

function tempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "acpf-test-"))
}

test("initializes APF workspace with Codex workstream state", () => {
  const dir = tempWorkspace()
  try {
    initializeFrameworkWorkspace(dir)
    expect(existsSync(join(dir, "framework", "state.json"))).toBe(true)
    expect(existsSync(join(dir, "framework", "status.md"))).toBe(true)
    const summary = summarizeFrameworkStatus(dir)
    expect(summary.state.single_ai.agent).toBe("pentester")
    expect(summary.state.single_ai.no_subagents).toBe(false)
    expect(summary.state.single_ai.no_judge_workflow).toBe(true)
    expect(readFileSync(join(dir, "framework", "runners", "README.md"), "utf8")).toContain("Codex workstreams")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("prepares Codex workstream swarm runner prompts and assignments", () => {
  const dir = tempWorkspace()
  try {
    initializeFrameworkWorkspace(dir)
    const runners = normalizeRunnerSpecs({
      goal: "Map scoped API authz hypotheses",
      runners: [
        { id: "api-a", role: "API mapper", task: "Map API routes" },
        { id: "api-b", role: "Authz checker", task: "Check object boundary candidates" },
      ],
    })
    const swarm = createSwarm({
      directory: dir,
      swarmId: "authz-swarm",
      goal: "Map scoped API authz hypotheses",
      runners,
      dispatch: false,
    })
    expect(swarm.status).toBe("prepared")
    expect(swarm.dispatch.mode).toBe("codex-workstream")
    expect(swarm.dispatch.agent).toBe("codex")
    expect(swarm.runners.length).toBe(2)
    expect(existsSync(join(dir, "framework", "runners", "authz-swarm", "tasks.md"))).toBe(true)
    expect(existsSync(join(dir, "framework", "runners", "authz-swarm", "api-a.md"))).toBe(true)
    const prompt = readFileSync(join(dir, swarm.runners[0].prompt_file), "utf8")
    expect(prompt).toContain("APF Codex Workstream Runner")
    expect(prompt).toContain("Record final output by writing")
    expect(prompt).not.toContain("runner_result")
    expect(swarm.runners[0].task_command).toContain("Codex swarm authz-swarm")
    const status = getSwarmStatus(dir, "authz-swarm")
    expect(status[0]?.runners[0]?.result).toBeUndefined()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
