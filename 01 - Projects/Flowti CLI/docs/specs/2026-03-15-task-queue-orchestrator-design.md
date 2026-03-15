# Task Queue Orchestrator — Auto-Dequeue, Health Monitor, Refresh

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Add task completion tracking, automatic queue processing, stale state recovery, and global UI refresh

## Problem

When an agent finishes a dispatched task, nothing happens — it goes idle without marking the task done or checking for queued work. If the CLI exits while an agent is busy, the state file stays "busy" forever, blocking future task assignment. And there's no way to refresh the UI when background state changes.

## Decision

Three features, all built into existing infrastructure — no new services, no polling, no daemons.

### 1. Completion Handler Auto-Dequeue

When `dispatch()` completes in agent-shell.ts:

1. Read agent state from `data-{agent}.json`
2. Find the first task matching `handle.task` with status `"pending"` or `"in-progress"` → mark it `"done"` via `completeFirstTask()` (new pure function — unlike `completeTask()` which marks ALL matches, this one marks only the first)
3. Find next task with `status: "pending"`
4. If found → re-read state to verify task is still pending (guards against manual intervention during cooldown), mark it `"in-progress"`, write state, wait 10s cooldown, re-dispatch with the same brief file
5. If not found → set agent `"idle"`, remove from active dispatches

The `briefPath` is captured in the `dispatch()` closure — it's a parameter to `dispatch()` and available to the completion handler without storing it on `DispatchHandle`.

All tasks accumulate in one brief per agent per iteration phase. Re-dispatches reuse the same brief file.

The 10s cooldown gives the user a window to intervene before the next task starts. During cooldown the agent shows as `"busy"` but isn't consuming a process.

**Non-zero exit codes**: If the dispatched process exits with a non-zero code, the task is still marked `"done"` (the agent attempted it). The inbox note will reflect the error status from `parseAgentResponse`. The queue continues to the next task — a single failure should not block the entire queue.

**Re-dispatch failure guard**: If the re-dispatched process immediately fails (non-zero exit), the same completion handler fires again. To prevent infinite loops, track a `failureCount` per agent in the shell closure. If a task fails on dispatch (exit code !== 0 AND no text output), increment the counter. If `failureCount >= 3`, stop auto-dequeue, set idle, write inbox note: "Auto-dequeue stopped after repeated failures." Reset counter on any successful completion.

### 2. Health Monitor — Stale State Recovery

A `reconcileStaleAgents()` method on `IAgentShell` that scans for inconsistent state. Returns `{ recovered: string[] }` — names of agents that were recovered, for startup logging.

1. Read all `data-*.json` files in `.flowti/var/`
2. For each agent with `status: "busy"`:
   - Check `getActiveDispatch(agentName)` — is there a running process?
   - If no active dispatch → **stale busy** (process died or CLI restarted)
3. For stale agents:
   - Set status to `"idle"`, write state
   - Write inbox note: "Process for {agent} was interrupted. Recovered to idle."
   - Do NOT auto-dispatch pending tasks during recovery — the health monitor only recovers state, it does not resolve agent definitions or brief paths. Users can re-assign tasks manually or use the roster menu.

**Why no auto-dispatch on recovery**: To call `dispatch()`, you need an `AgentSummary` (with ai config, tools, provider, etc.) and a valid brief path. The state file (`data-{agent}.json`) only stores the agent name and task list — not the full definition or brief location. Resolving these would require importing `listAgents()` from domain and scanning brief directories, adding complexity and cross-layer coupling. Recovery to idle is sufficient; the user can re-trigger from the CLI.

**Where it runs:**
- Once at CLI startup (`main.ts` after deps created)
- On each start view render (`register-handlers.ts`)

**Corrupt state files**: If a `data-*.json` file contains invalid JSON, `readAgentState()` already handles this gracefully — it returns `emptyState()` (idle, no tasks). No special handling needed in the health monitor.

### 3. Global Refresh Signal

Implemented as a **router-level reserved key**, not a per-page sitemap action. This avoids key conflicts with existing page actions and doesn't require modifying all 28 pages.

The `SitemapRouter` checks for the `r` key before delegating to page actions. When detected:

```
router.#handleInput receives "r"
  → if key === "r": return "refresh" sentinel
  → #applyResult checks for "refresh"
  → re-runs current page's render cycle without modifying the navigation stack
```

This is analogous to how `q` (quit) is handled as a built-in `runMenu` behavior. The `"refresh"` return value is a new `MenuResult` variant.

**No sitemap.json changes needed.** The router handles it internally.

## Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where auto-dequeue lives | `dispatch()` completion handler in agent-shell.ts | Natural hook — already runs on exit, has access to agent name and brief path in closure |
| Task completion | New `completeFirstTask()` — marks first matching task only | Existing `completeTask()` marks ALL matches via `.map()`, which would skip queued duplicates |
| Brief strategy | Reuse same brief file, captured in closure | Tasks accumulate per phase, agent sees full context. No interface change needed. |
| Cooldown | 10s setTimeout with pre-dispatch state re-read | Gives user intervention window; re-read guards against manual state changes during cooldown |
| Failure guard | Counter in shell closure, max 3 consecutive failures | Prevents infinite re-dispatch loops when binary is broken |
| Health recovery | Recover to idle only, no auto-dispatch | State file lacks agent definition and brief path needed for dispatch |
| Health return type | `{ recovered: string[] }` | Enables startup logging and testable assertions |
| Refresh mechanism | Router-level reserved key `r` | No sitemap changes, no key conflicts, consistent with `q` for quit |

## Internal Architecture

### Auto-Dequeue Flow

```
dispatch exit handler
  → read agent state from varDir
  → completeFirstTask(state, handle.task) — marks first matching pending/in-progress task as done
  → write updated state
  → check exit code: if non-zero and no text output, increment failureCount
  → if failureCount >= 3: set idle, write inbox note, return
  → nextTask = state.tasks.find(t => t.status === "pending")
  → if nextTask:
      → setTimeout(10_000) — cooldown
      → re-read state, verify nextTask still pending (abort if not)
      → update task status to "in-progress", write state
      → re-dispatch with same briefPath (from closure), nextTask.name as task
      → write inbox note: "Starting next task: {name}"
  → else:
      → set status "idle", remove from activeDispatches
      → write inbox note: "All tasks complete"
```

### Health Monitor Flow

```
reconcileStaleAgents(): { recovered: string[] }
  → list data-*.json in varDir
  → for each with status "busy":
      → if getActiveDispatch(name) is null:
          → stale! set status "idle", write state
          → write inbox note: "Process interrupted. Recovered to idle."
          → add name to recovered list
  → return { recovered }
```

### Refresh Signal Flow

```
router.#handleInput receives key
  → if key === "r": return "refresh"
  → #applyResult detects "refresh"
  → re-run current page render (beforeRender → view → actions)
  → do NOT modify navigation stack
```

## Edge Cases

- **Duplicate task names**: `completeFirstTask()` marks only the first match with status `"pending"` or `"in-progress"`, preserving remaining duplicates in queue.
- **Brief file deleted**: If brief file is missing when re-dispatch triggers, skip re-dispatch, set idle, write inbox note explaining why.
- **Agent removed while busy**: Health monitor finds no agent definition but state file exists. Recovery: set idle, leave orphan state file (no dispatch attempted).
- **Multiple rapid completions**: Each completion handler runs independently. The 10s cooldown prevents rapid cascading. The `activeDispatches` map prevents double-dispatch for the same agent.
- **CLI exits during cooldown**: The setTimeout is in-process — if CLI exits, the dispatch never fires. Health monitor recovers on next startup.
- **Manual state change during cooldown**: Pre-dispatch re-read catches this — if task is no longer pending, re-dispatch is aborted.
- **Repeated dispatch failures**: Failure counter stops auto-dequeue after 3 consecutive failures. Counter resets on any successful completion (exit code 0 with text output).
- **Corrupt state files**: `readAgentState()` returns `emptyState()` on parse errors — health monitor treats these as idle (no recovery needed).
- **Key `r` conflict**: Router-level handling means `r` is reserved globally. Pages that previously used `r` for a page action will need that action reassigned to a different key. (Verify no current conflicts exist during implementation.)

## Files

### Modified (5)

| File | Change |
|------|--------|
| `src/infrastructure/agent-shell.ts` | Completion handler: `completeFirstTask` → dequeue next → 10s cooldown → re-dispatch. Add `reconcileStaleAgents()` method. Add `failureCount` map in closure. |
| `src/infrastructure/types.ts` | Add `reconcileStaleAgents(): { recovered: string[] }` to `IAgentShell`. Add `"refresh"` to `MenuResult` type. |
| `src/ui/handlers/register-handlers.ts` | Call `deps.agentShell.reconcileStaleAgents()` in start view render |
| `src/main.ts` | Call `deps.agentShell.reconcileStaleAgents()` at startup after deps created |
| `src/infrastructure/sitemap-router.ts` | Handle `"r"` key as reserved refresh → re-render current page |

### Modified (domain)

| File | Change |
|------|--------|
| `src/domain/agents/agent-state.ts` | Add `completeFirstTask(state, taskName)` — marks first matching pending/in-progress task as done (unlike `completeTask` which marks all) |

### Not Changed

- `brief-store.ts` — briefs already accumulate tasks
- `agent-session.ts` — session tracking unchanged
- `configs/sitemap.json` — refresh handled at router level, not per-page

## Testing

### agent-shell.test.ts (new tests)

**Auto-dequeue:**
- Completion marks first matching task done in state (not all matches)
- Completion dispatches next pending task after 10s cooldown (fake timers)
- Completion sets idle when no pending tasks
- Re-dispatch uses same brief path from closure
- Re-dispatch skipped when brief file missing
- Re-dispatch skipped when task status changed during cooldown
- Non-zero exit code still marks task done, continues queue
- Failure counter stops auto-dequeue after 3 consecutive failures
- Failure counter resets on successful completion

**Health monitor:**
- Recovers stale busy agent to idle
- Does not auto-dispatch on recovery (just sets idle)
- Ignores agents with active dispatches
- Ignores idle agents
- Returns recovered agent names
- Writes inbox note on recovery
- Handles corrupt state files gracefully

### agent-state.test.ts (new tests)

- `completeFirstTask` marks only first pending match
- `completeFirstTask` marks in-progress match if no pending match
- `completeFirstTask` leaves other tasks with same name unchanged
- `completeFirstTask` returns idle status when all tasks done

### sitemap-router.test.ts (new tests)

- `r` key triggers re-render of current page
- `r` key does not modify navigation stack
- `r` key does not interfere with page actions
