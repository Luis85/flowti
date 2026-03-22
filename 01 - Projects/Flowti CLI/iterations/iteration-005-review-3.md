---
type: IncrementReview
iteration: 5
date: 2026-03-22
scopeCompleted: 39
scopeTotal: 68
completionRate: 57%
---

# Increment Review #3 — Iteration #5: Agent World

## Summary

- Scope items completed: 39/68 (57%)
- Items accepted: 0
- Items accepted with notes: 4 (all need live testing)
- Items rejected: 0
- Items carried over: 8 (must-complete for productive agent world)
- Items added as stretch: 3
- Items dropped: 3

## Scope Item Results — Delivered Since Last Review

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | LLM Session Management (persistent sessions, priming, decay) | accepted with notes | Needs live testing — validate priming, decay, session reuse work |
| 2 | Task & Economy Engine (XP/Coin/Token, merchant, trust) | accepted with notes | Needs live testing — validate reward loop, trust progression |
| 3 | Interaction Expansion (83 templates, entity coverage) | accepted with notes | Needs live testing — validate click-to-interact end-to-end |
| 4 | Agent World Visual Overhaul (review-driven fixes) | accepted with notes | Needs live testing — validate BT sync, debug, merchant |

## Must-Complete Scope (Remainder of Iteration)

| # | Item | Priority | Rationale |
|---|------|----------|-----------|
| C0 | Plugin hardening (view lifecycle, error recovery, graceful degradation) | P1 | Plugin works but needs hardening for edge cases |
| BT | Wire all 7 BT→Brain transitions (seek-food/drink/rest/merchant/agent/quiet, break) | P1 | Agents need autonomous needs-driven behavior |
| B3 | Task execution: wire CLI agent runner (real work, not simulated) | P1 | Agents must actually do work |
| B1 | Data export: goals, behaviors, project, iteration, phase | P1 | Agents need full context to be productive |
| B2 | World state reconciliation: `onStateDiff` | P1 | World must reflect reality, not drift |
| B6 | Interactive waiting: small talk while LLM works | P2 | UX — user sees agent is alive while working |
| C3 | Flowti CLI View in Plugin (entry point for CLI features) | P2 | Plugin IS the UI — users need access to CLI features |
| — | Live testing: LLM sessions, economy, interactions | P2 | Validation of all accepted-with-notes items |

## Stretch Goals

| Item |
|------|
| B4 Game feel (particles, emotes, workstation glow) |
| B5 Proximity conversations |
| C4 Skill execution from Plugin |

## Dropped

| Item | Reason |
|------|--------|
| C1 TUI Ink migration regression | TUI removed by design — CLI is headless core, Plugin IS the UI |
| C2 CLI bundling into Plugin | Infrastructure concern, not agent world |
| C5 Storybook integration rework | Not agent world |

## Quality Metrics

- Tests: 6,766 passing, 0 failing, 3 skipped (intentional journey suites)
- Test suites: 401 passing, 0 failing
- Lint: 0 errors, 0 warnings
- Build: Passing
- Commits since last review: 151
- Files changed: 51 (+10,826 / -402 lines)

## Stakeholder Feedback

### 1. Agent status driven by Brain + BT, not LLM state

Agent visual status must reflect the **brain state** (wandering, working, on-break, talking, seeking), not raw LLM activity. The LLM is one tool in the agent's toolbox — the brain decides when to use it. The 7 missing BT→Brain transitions are critical for autonomous behavior.

### 2. LLM session primed on agent selection, not on first talk

The LLM session is acquired and primed the moment an agent is selected — making it always-on infrastructure for the selected agent. When the brain later decides to talk or execute a task, the session is already warm with zero latency. The decay timer keeps it alive during brief agent switches. This is already implemented in the LLM Session Management feature.

### 3. TUI removed by design — Plugin is the sole UI

The CLI is a headless core. All user-facing UI lives in the Plugin. The TUI removal is intentional architecture, not a regression. C1 (TUI fix) dropped accordingly. C3 (Flowti CLI View in Plugin) stays in scope as the replacement entry point.

### 4. Brain-initiated LLM sessions for autonomous task execution

When an agent self-assigns a task (or receives one while not selected), the brain must be able to start an LLM session on its own — not wait for user selection. The current implementation ties session acquisition to `spawnWorker()` (user selects agent). The brain's BT must also be able to trigger `acquireSession` when it decides to execute a task or needs LLM reasoning. This means:
- LLM session lifecycle is decoupled from user selection
- Brain can request a session via the worker manager when BT evaluates "execute-task"
- Multiple agents can have active LLM sessions concurrently (process pool / concurrency limits apply)
- Decay timer applies to brain-initiated sessions the same way

## Follow-Up Items

- Live testing session needed for all 4 accepted-with-notes items before full acceptance
- C0 (Plugin views crash) must be resolved before any other work can proceed
- BT transition wiring unlocks the full autonomous agent behavior loop
- Brain-initiated LLM sessions required for autonomous task execution (new requirement from review)
