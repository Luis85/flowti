# AgentShell Clean-Slate Removal

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `agentShell` and all backward-compatibility code. The worker architecture + process runner are the only agent execution systems.

**Architecture:** UI menus use `processRunner.spawn()` for interactive LLM calls (talk, clarify, dispatch). The worker manager handles background reactivity. `agent-inbox.ts` becomes standalone (deps type from process-runner). The `IAgentShell` interface, `agent-shell.ts`, and all references are deleted.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

---

## File Structure

### Files to delete (2 source + 2 test)

| File | Reason |
|------|--------|
| `src/infrastructure/agent-shell.ts` | Replaced by worker-manager + process-runner |
| `tests/infrastructure/agent-shell.test.ts` | Implementation deleted |
| `tests/infrastructure/agent-inbox.test.ts` | Will re-test after deps change |

### Files to modify (14 source + 5 test)

| File | Change |
|------|--------|
| `src/infrastructure/agent-inbox.ts` | Change `ShellBaseDeps` import to `ProcessRunnerDeps` from agent-process-runner |
| `src/infrastructure/types.ts` | Remove `IAgentShell`, `TalkSession`, `TalkResult`, `TalkOptions`, `ProviderConfig`, `DispatchHandle`, `DispatchOptions`, `PendingQuestion` |
| `src/infrastructure/deps.ts` | Remove `agentShell` from `CliDeps`, remove `AgentMenuDeps`, remove `createAgentShell` import |
| `src/main.ts` | Remove `agentShell.reconcileStaleAgents()` |
| `src/ui/menus/agents-interact-menu.ts` | Replace `TalkDeps` → use `processRunner`, replace `agentShell.talk()` → `processRunner.spawn()` |
| `src/ui/menus/roster-task-menu.ts` | Same pattern as agents-interact-menu |
| `src/ui/menus/agents-run-menu.ts` | Replace `agentShell.dispatch()` → `processRunner.spawn()` |
| `src/ui/handlers/extensibility-handlers.ts` | Replace `agentShell.getActiveDispatch()` → `workerManager.getWorker()` |
| `src/ui/handlers/agent-task-handlers.ts` | Replace `agentShell.dispatch()` → `processRunner.spawn()` |
| `src/infrastructure/sitemap-router.ts` | Remove `pendingQuestions()`/`answerAgent()` calls |
| `src/ui/handlers/register-handlers.ts` | Remove `agentShell.reconcileStaleAgents()` beforeRender |
| `docs/features/agent-worker-architecture.md` | Remove migration section, update to reflect clean-slate |
| `tests/ui/menus/agents-menu.test.ts` | Remove agentShell mock, add processRunner mock |
| `tests/ui/handlers/extensibility-handlers.test.ts` | Same |
| `tests/ui/handlers/register-handlers.test.ts` | Same |
| `tests/ui/menus/agents-run-menu.test.ts` | Same |
| `tests/ui/menus/roster-task-menu.test.ts` | Same |

---

## Chunk 1: Infrastructure Cleanup

### Task 1: Update agent-inbox.ts deps

- [ ] Change `ShellBaseDeps` import to `ProcessRunnerDeps` from agent-process-runner.ts
- [ ] Commit

### Task 2: Remove IAgentShell from types.ts

- [ ] Delete the entire `IAgentShell`, `ProviderConfig`, `TalkOptions`, `TalkResult`, `TalkSession`, `DispatchOptions`, `DispatchHandle`, `PendingQuestion` interfaces
- [ ] Commit

### Task 3: Remove agentShell from deps.ts

- [ ] Remove `IAgentShell` from imports
- [ ] Remove `agentShell` field from `CliDeps`
- [ ] Remove `AgentMenuDeps` type alias
- [ ] Remove `createAgentShell` import and call from `createDefaultDeps()`
- [ ] Commit

### Task 4: Clean up main.ts

- [ ] Remove `agentShell.reconcileStaleAgents()` call
- [ ] Commit

### Task 5: Delete agent-shell.ts and its tests

- [ ] Delete `src/infrastructure/agent-shell.ts`
- [ ] Delete `tests/infrastructure/agent-shell.test.ts`
- [ ] Delete `tests/infrastructure/agent-inbox.test.ts` (will recreate with updated deps)
- [ ] Commit

---

## Chunk 2: Rewire UI Menus

### Task 6: Rewire agents-interact-menu.ts

Replace `agentShell.talk()` with `processRunner.spawn()`:

- [ ] Replace `TalkDeps` type: remove `agentShell`, add `processRunner: IAgentProcessRunner`
- [ ] Update `sendTurn()`:
  - Build prompt same as before
  - Call `deps.processRunner.spawn(agent, content)` instead of `deps.agentShell.talk()`
  - The `AgentProcess` has same `onEvent` API — stream handling unchanged
  - Parse result: `parseAgentResponse(result.text)` instead of `result.response`
  - Replace `session.detach()` with `proc.kill()` (user steps away = kill process)
- [ ] Update `runClarificationLoop()`: same pattern
- [ ] Update `clarifyTaskInteractive()`: same pattern
- [ ] Run tests, commit

### Task 7: Rewire roster-task-menu.ts

- [ ] Replace `RosterTaskDeps` type: remove `agentShell`, add `processRunner`
- [ ] Update talk/dispatch calls to use `processRunner.spawn()`
- [ ] Run tests, commit

### Task 8: Rewire agents-run-menu.ts

- [ ] Replace `RunMenuDeps` type: remove `agentShell`, add `processRunner`
- [ ] Update `runBriefInteractive()` and `spawnAndStream()`:
  - Call `deps.processRunner.spawn(agent, briefContent)` reading brief file
  - Use `proc.onEvent()` for streaming display
- [ ] Run tests, commit

---

## Chunk 3: Rewire Handlers

### Task 9: Rewire extensibility-handlers.ts

- [ ] Replace `agentShell.getActiveDispatch(agent.name)` with `workerManager.getWorker(agent.name)?.state === "working"`
- [ ] Remove pendingQuestions/answerAgent usage (sitemap-router handles this differently now — remove the feature for clean slate)
- [ ] Commit

### Task 10: Rewire agent-task-handlers.ts

- [ ] Replace `agentShell.dispatch()` with `processRunner.spawn()` for task launching
- [ ] Commit

### Task 11: Rewire sitemap-router.ts + register-handlers.ts

- [ ] Remove `pendingQuestions()` and `answerAgent()` from sitemap-router
- [ ] Remove `agentShell.reconcileStaleAgents()` from register-handlers
- [ ] Commit

---

## Chunk 4: Test Cleanup + Verification

### Task 12: Update all test mocks

- [ ] Remove `agentShell` mock from all test files
- [ ] Add `processRunner` mock where needed
- [ ] Ensure `workerManager` mock has all needed methods
- [ ] Run full test suite
- [ ] Run type check
- [ ] Run lint
- [ ] Build
- [ ] Commit

### Task 13: Update feature doc

- [ ] Remove "Migration" section from agent-worker-architecture.md
- [ ] Update "What Changed" to reflect clean-slate (no backward compat)
- [ ] Commit
