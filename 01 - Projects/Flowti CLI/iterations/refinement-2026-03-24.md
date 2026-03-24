---
type: RefinementSession
date: 2026-03-24
iteration: 5
itemsReviewed: 11
itemsRefined: 7
---

# Backlog Refinement — 2026-03-24

## Summary

- Items reviewed: 11 (7 active scope + 4 requirements)
- Items refined: 7
- Items split: 0
- Items rejected: 0
- Items closed: 2 (live testing done, TUI RAID closed)
- Items deferred: 4 (requirements → Iteration 6)

## Context

Post-Three Amigos refinement with 4 days remaining in Iteration 5. Live testing completed. Phase C0 done. Phase C3 + C4 formally deferred. TUI RAID issue closed (TUI dropped by design).

## Refined Items

| Rank | Item | Estimate | Priority | Dependency | Status |
|------|------|----------|----------|------------|--------|
| 1 | Data export: verify CLI mapper populates goals/behaviors/project/iteration/phase | S | must | — | refined |
| 2 | Task execution: Panel → CliExecutor → brain state wiring | L | must | — | refined |
| 3 | World state reconciliation: onStateDiff handler | M | should | — | refined |
| 4 | Decouple session acquisition from spawnWorker() | M | could | — | refined |
| 5 | Brain can request LLM session via worker manager | L | could | #4 | refined |
| 6 | Multiple concurrent LLM sessions (maxConcurrent) | M | could | #4 | refined |
| 7 | Decay timer for brain-initiated sessions | S | could | — | refined |

## Acceptance Criteria (updated)

### Data Export Verification (Rank 1)

- [ ] CLI-side `agent-dashboard-sync.ts` populates `goals`, `behaviors`, `project`, `iteration`, `phase` in export JSON
- [ ] Plugin-side DashboardAgent receives populated fields (verify in running world)
- [ ] If fields are already populated, mark scope item done

### Task Execution Wiring (Rank 2)

- [ ] Given user assigns task in Plugin panel, CLI worker manager receives and spawns LLM
- [ ] Given LLM generates output, Plugin receives streamed response via JSONL events
- [ ] Given task completes, agent transitions from "working" to "idle" with completion bubble
- [ ] Given agent is already working when new task assigned, task is queued or rejected cleanly
- [ ] Given CLI executor crashes mid-task, agent does not get stuck in "working" forever

### World State Reconciliation (Rank 3)

- [ ] Given CLI agent modifies world-state.json, game engine detects and applies changes
- [ ] Given game engine flushes positions at same time as CLI write, no file corruption
- [ ] Given CLI adds new agent not in scene, game handles gracefully (ignore or spawn)

### Phase E: Brain-Initiated LLM Sessions (Ranks 4-7)

- [ ] Session acquisition decoupled from spawnWorker() — available to any spawned worker on demand
- [ ] Given BT evaluates "execute-task" as ready, brain autonomously acquires LLM session
- [ ] Given `maxConcurrent: 2` and 3 agents requesting, only 2 active, 1 queues
- [ ] Given queued agent's BT ticks again before session granted, no double-request
- [ ] Given brain-initiated session completes, decay timer fires and releases cleanly

## Capacity Assessment

- **Must items:** S + L = ~6-8h (~1.5 days)
- **Should items:** M = ~2-4h (~0.5 day)
- **Could items:** M + L + M + S = ~10-14h (~2-3 days)
- **Total available:** 4 days
- **Projection:** Must + Should fit comfortably. Phase E is attempt-if-time.

## Decisions

- Live testing marked done (user completed sessions)
- TUI RAID issue closed — TUI dropped by design, Plugin is sole UI
- Phase C3 + C4 formally deferred to Iteration 6 (confirmed in Three Amigos)
- Phase E dependency: item #4 (decouple) unblocks #5 and #6
- Data export may already be done — verify before writing code

## Carry-Over to Iteration 6 Backlog

| Item | Source | Priority | Notes |
|------|--------|----------|-------|
| CLI-Plugin Integration Modal | requirement | high | Relates to C3 |
| Plugin Skill Execution | requirement | high | C4 scope |
| LLM Provider Abstraction (Claude + Cursor) | requirement | high | Agent shell design needed |
| RPG Interactive Waiting (small talk during LLM) | requirement | high | Talk engine expansion |
| Phase C3: Flowti CLI View | scope/deferred | — | Multi-week effort |
| Phase C4: Skill Execution from Plugin | scope/deferred | — | Depends on C3 |
