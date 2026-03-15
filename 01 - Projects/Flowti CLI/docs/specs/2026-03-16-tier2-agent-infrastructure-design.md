# Tier 2: Agent Infrastructure Sprint — Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Scope:** Three sequentially dependent features that complete the agent observability and control stack

## Overview

Three features form a pipeline: raw agent output → structured events → observable state → controlled tool access.

```
Agent Process → stream-json → AgentStreamEvent → WorldStateManager → PermissionEngine
                  (Plan A)         (Plan B)              (Plan C)
```

**Total scope:** ~125 steps, 12 new files, 22 modified files, 7 test files.

## Phase A: Agent Interaction V2 — Stream-JSON Pipeline

**Goal:** Replace opaque `--print` with `--output-format stream-json` for live thinking display and structured session logs.

**Key deliverables:**
1. `AgentStreamEvent` typed union (thinking, text, tool-start, tool-input, tool-end, error, usage, done)
2. Pure `parseStreamLine()` parser + stateful `StreamState` accumulator
3. `agent-conversation-store.ts` for conversation persistence (threads + turns)
4. `buildClaudeArgs()` unified arg builder with `--verbose` for thinking events
5. `thinkingDisplay` config: "full" | "indicator" | "hidden"
6. Talk flow migrated from batch to streaming with `--prompt-file`

**Files:**
- New: `src/domain/agents/agent-stream.ts`, `src/domain/agents/agent-conversation-store.ts` + tests
- Modified: `agent-types.ts`, `agent-runner.ts`, `agent-process.ts`, `shell.ts`, `types-config.ts`, `agents-interact-menu.ts`, `agents-run-menu.ts`, `agent-run-display.ts`

**Depends on:** Nothing (generates events consumed by B and C)

## Phase B: World State Model — ECS-Compatible Agent Environment

**Goal:** Unified `.flowti/var/world-state.json` capturing agents, projects, iterations, and activity log — queryable via `flowti state` CLI.

**Key deliverables:**
1. `WorldState` type with typed entities (agents, projects, iterations) + activity log
2. `WorldStateManager` singleton: in-memory state, debounced 1s write, migration from legacy `data-*.json`
3. `mapStreamEventToAction()` maps `AgentStreamEvent` → 12 `AgentActionType`s
4. `flowti state` CLI command with `--agent`, `--format=json`, `--watch` flags
5. Dashboard-friendly single file replacing scattered `data-*.json`

**Files:**
- New: `src/domain/agents/world-state-types.ts`, `src/domain/agents/world-state-manager.ts`, `src/domain/agents/action-mapper.ts`, `src/controller/state.controller.ts`, `src/ui/displays/state-display.ts` + tests
- Modified: `agent-shell.ts`, `deps.ts`, `main.ts`, command registry

**Depends on:** Phase A (consumes `AgentStreamEvent` in action mapper)

## Phase C: Agent Permission Model — Three-Tier Tool Approval

**Goal:** Replace flat `allowedTools` with policy-based permission system for background workers.

**Key deliverables:**
1. `PermissionMode` union: "ask" | "auto-allow" | "trust"
2. `DEFAULT_SAFE_TOOLS`: Read, Glob, Grep, LS, WebSearch, WebFetch
3. Policy resolution: state override → definition default → fallback
4. `PermissionGrant` persistence in agent state (tool, scope: once/always, grantedAt)
5. Background worker queue: stalled tool → requesting-permission action → user approval → re-spawn
6. `clearOnceGrants()` removes session-only grants after completion

**Files:**
- New: `src/domain/agents/permission-engine.ts` + test
- Modified: `agent-types.ts`, `agent-state.ts`, `agent-process-runner.ts`, `worker-manager.ts`, `world-state-types.ts`, sitemap + handlers

**Depends on:** Phase A (tool names from `tool-start` events), Phase B (permission actions in world state)

## Execution Strategy

### Optimal order: A → B → C (strictly sequential)

Phase A must complete before B can wire the action mapper. Phase B must define `AgentActionType` before C can emit permission actions. No parallelism between phases.

Within each phase, tasks CAN be parallelized:
- Phase A: stream parser + conversation store are independent
- Phase B: world state manager + action mapper + CLI controller are partially independent
- Phase C: permission engine is self-contained; integration is sequential

### Iteration fit

| Phase | Effort | Can ship independently? |
|-------|--------|------------------------|
| A: Stream-JSON | ~14h | Yes — live thinking display works alone |
| B: World State | ~13h | Yes — `flowti state` works with stream events |
| C: Permissions | ~11h | Yes — policy engine works with default grants |

**Recommendation:** Execute as 3 separate workspace plans. Each ships independently. Phase A in current iteration, B+C in next iteration or same if capacity allows.

## Shared Infrastructure

These files are touched by 2+ phases:
- `src/domain/agents/agent-types.ts` — A adds stream types, C adds permission types
- `src/infrastructure/agent-shell.ts` — B wires action mapper, C wires permission resolution
- `src/infrastructure/types-config.ts` — A adds thinkingDisplay config, C adds permission defaults
- `src/main.ts` — B registers world state manager, C registers permission bootstrap

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stream-JSON format changes between Claude versions | High | Parser uses defensive parsing with unknown fallback |
| World state file grows unbounded | Medium | Activity log ring buffer (max 500 entries, configurable) |
| Permission queue blocks agent indefinitely | Medium | Timeout + fallback to "ask" mode with notification |
| Three phases in one iteration overloads capacity | Low | Each phase ships independently; can defer C |

## Non-Goals

- GUI dashboard (world state is CLI + JSON only)
- Multi-agent permission delegation (each agent's grants are independent)
- Conversation branching (V2 is linear threads only)
- Real-time WebSocket streaming to external consumers
