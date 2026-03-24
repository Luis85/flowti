---
type: ThreeAmigosReview
iteration: 5
scopeItem: "Batch review — all open items (4 days remaining)"
date: 2026-03-24
aligned: true
---

# Three Amigos Review — Iteration 5 Batch (All Open Items)

## Context

Follow-up to the 2026-03-22 batch review. 4 days remaining until iteration end (2026-03-28). Phase C0 (Plugin Hardening) completed by user. Cross-room station fallback implemented same day. Blackboard + ECS locomotion migration in progress (worktree). DashboardAgent type already has all required fields.

## Items Reviewed

### Phase C0: Plugin Hardening — DONE (verified 2026-03-24)

User completed and verified. Marked done in iteration plan.

### Phase C3: Flowti CLI View — DEFERRED to Iteration 6

**Product Owner:** Multi-week scope, 4 days insufficient. Formally deferred.
**Architect:** Requires view registration, terminal emulation, tab system, process management, bidirectional comms. Cannot compress.
**Tester:** Would introduce major untested surface area if rushed.

### Phase C4: Skill Execution — DEFERRED to Iteration 6

Already deferred in previous review. Confirmed.

### Live Testing & Validation — P0 (gate for everything else)

4 manual exploratory sessions. Must run before Phase E.

**Product Owner:** Validation gates, not features. Proves foundation is solid.
**Architect:** Manual verification — build CLI + Plugin, run in Obsidian, exercise features.
**Tester:** Interactive exploratory testing with checklists:

- [ ] LLM sessions: spawn → priming → reuse → stop (decay) → timeout → cleanup
- [ ] Task & Economy: assign → XP reward → coin → trust level
- [ ] Interactions: click agent → panel → send message → response
- [ ] Visual overhaul: BT drives behavior → debug panel → merchant → cross-room stations

**Edge cases to probe:** rapid start/stop, session after timeout, double-spawn, assign while busy, click during walk/talk, rapid multi-click, all 5 scenes.

### Phase B Gaps — 3 Items

#### Data Export

**Previous AC:** Add `goals`, `behaviors`, `project`, `iteration`, `phase` to DashboardAgent.
**Finding:** DashboardAgent type already has all these fields and they're populated from agent markdown + world-state. Need to verify CLI-side `agent-dashboard-sync.ts` actually exports them.
**Updated AC:** Verify during live testing. If CLI export mapper populates all fields, mark done.

#### World State Reconciliation

- [ ] Given CLI agent modifies world-state.json, game engine detects and applies changes
- [ ] Given game engine flushes positions at same time as CLI write, no file corruption
- [ ] Given CLI adds new agent not in scene, game handles gracefully (ignore or spawn)

**Approach:** File watcher or polling diff on `.flowti/var/world-state.json`. Last-writer-wins with timestamp check to avoid conflicts.

#### Task Execution

- [ ] Given user assigns task in Plugin panel, CLI worker manager receives and spawns LLM
- [ ] Given LLM generates output, Plugin receives streamed response via JSONL events
- [ ] Given task completes, agent transitions from "working" to "idle" with completion bubble
- [ ] Given agent is already working when new task assigned, task is queued or rejected cleanly
- [ ] Given CLI executor crashes mid-task, agent does not get stuck in "working" forever

**Approach:** Wire Plugin panel action → `CliExecutor.send()` → stream output via JSONL → brain state update. Existing `CliExecutor` protocol handles transport.

### Phase E: Brain-Initiated LLM Sessions — Attempt if time permits

Gated by live testing results.

- [ ] Given BT evaluates "execute-task" as ready, brain autonomously acquires LLM session
- [ ] Given `maxConcurrent: 2` and 3 agents requesting, only 2 active, 1 queues
- [ ] Given brain-initiated session completes, decay timer fires and releases cleanly
- [ ] Session acquisition works for any spawned worker, not just user-triggered ones
- [ ] Given queued agent's BT ticks again before session granted, no double-request

**Risks:** conversation history always `[]`, "thinking" state potentially unreachable.

## Execution Priority (4 days)

1. **Live testing session** — validates sessions, economy, interactions, visuals (P0, ~half day)
2. **Data export verification** — check CLI mapper, fix if needed (P1, small)
3. **Task execution wiring** — Panel → CliExecutor → brain state (P1, ~1 day)
4. **World state reconciliation** — file watcher + diff handler (P1, ~half day)
5. **Phase E** — brain-initiated sessions, attempt if time permits (P2, ~1-2 days)

## Alignment

- **Status:** Aligned
- **C0 resolved:** Done by user, verified working
- **C3 + C4 formally deferred:** Multi-week scope, insufficient time remaining
- **Data export AC under review:** Type has fields, need to verify CLI export populates them
- **All three perspectives agree on:** execution order, deferrals, live testing as prerequisite gate
