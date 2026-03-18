---
type: RefinementSession
date: 2026-03-18
iteration: 6
itemsReviewed: 17
itemsRefined: 10
---

# Backlog Refinement — 2026-03-18

## Focus

Flowti Ecosystem product readiness — CLI + Plugin bundled as a single product in the coming weeks.

## Context

Full vault review conducted: 5 iterations (1-4 done, 5 in-progress), 44 specs, 44 plans, 4 requirements, 1 critical RAID issue, 579 inbox items, 26 agents. Iteration 5 Phase A+B delivered, Phase C in-progress.

## Summary

- Items reviewed: 17
- Items refined: 10
- Items already active (in-progress): 7
- Items dropped: 1
- Items deferred: 1

## Active Items (In-Progress)

| # | Item | Estimate | Source |
|---|------|----------|--------|
| 1 | C0: Fix Plugin View Crash | M | RAID / Phase C |
| 2 | C1: TUI Ink Migration — Restore Missing Features | L | RAID |
| 3 | C2: CLI Bundling into Plugin | S | Requirement (critical) |
| 4 | C3: Flowti CLI View (main entry point) | L | Requirement (critical) |
| 5 | C4: Plugin Skill Execution | L | Requirement (high) |
| 6 | C5: Storybook Integration (reworked) | M | Requirement |
| 16 | LLM Provider Abstraction | XL | Spec 2026-03-18 |

## Refined Items — Must (Product Launch)

| # | Item | Estimate | Priority | Status |
|---|------|----------|----------|--------|
| 8 | Plugin Config Schema Alignment | S | must | refined |
| 7 | Plugin Management Domain Bootstrap | M | must | refined |
| 11 | Data Export Gap (DashboardAgent fields) | S | must | refined |
| 14 | Agent World Polish (particles, emotes, glow) | M | must | refined |
| 15 | Proximity Conversations | M | must | refined |
| 12 | World State Reconciliation | L | must | refined |
| 13 | Task Execution Wiring | L | must | refined |
| 10 | CLI as Universal Report Engine | XL | must | refined |

## Refined Items — Could (Post-Launch)

| # | Item | Estimate | Priority | Status |
|---|------|----------|----------|--------|
| 17 | Inbox Triage (579 items) | L | could | deferred |

## Dropped Items

| # | Item | Reason |
|---|------|--------|
| 9 | Plugin Health Snapshot | Already working — `flowti health --project="Flowti Plugin"` functions today via filesystem project discovery |

## Item Details

### 8 — Plugin Config Schema Alignment (S, must)

**Refined from original 15-gap estimate down to 4 actual gaps:**

1. Key naming mismatch: CLI uses `management.features.dir`, Plugin uses `management.lifecycle.featuresDir` — normalize
2. Docs references: Plugin has 5 vs CLI's 17 — add applicable Plugin-specific references
3. Missing `agents.dashboard` in Plugin config
4. Verify all management directories exist on disk

**Acceptance Criteria:**
- Normalize `management.lifecycle.featuresDir` → `management.features.dir` to match CLI convention
- Verify all 9 management directories exist on disk under Plugin project
- Add `agents.dashboard: true` if Plugin agents should appear in dashboard
- Decide which additional doc references apply to Plugin
- `flowti health --project="Flowti Plugin"` runs clean

### 7 — Plugin Management Domain Bootstrap (M, must)

**Acceptance Criteria:**
- All 9 management directories created under `01 - Projects/Flowti Plugin/`
- `flowti.config.json` management section populated with directory paths
- Iteration orchestration config with agent bindings
- Agent roster subset declared (PO, Architect, Developer, Tester, UI Designer, UX Designer)
- `flowti info --project="Flowti Plugin"` reports all domains as configured

### 11 — Data Export Gap (S, must)

**Scope:** CLI `exportAgentDashboardData()` adds `goals`, `behaviors`, `project`, `iteration`, `phase` to the export payload.

**Acceptance Criteria:**
- Game-side `DashboardAgent` type includes all 5 fields
- Panel info tab displays them
- SSE sync delivers them

### 14 — Agent World Polish (M, must)

**Three bundled joy items:**
- Particle footsteps + dust puffs on arrival
- Mood emotes floating above agents (Ninja Adventure emote sprites)
- Workstation screen glow + activity sparks

**Value thesis (from 03-17 refinement):** "The world's value isn't 'a dashboard that moves.' It's a place you want to visit." Joy items are core product, not polish.

### 15 — Proximity Conversations (M, must)

**Scope:** `social-system.ts` with pairwise distance detection, personality-driven spontaneous dialogue when related agents are nearby.

**Acceptance Criteria:**
- Agents within proximity threshold trigger conversation
- Dialogue is personality-driven (uses agent personality traits)
- Speech bubbles show conversation flow
- Conversations don't interrupt working state

### 12 — World State Reconciliation (L, must)

**Scope:** `onStateDiff` handler processes real changes from CLI.

**Acceptance Criteria:**
- Added entities spawn new agent actors (with entrance animation)
- Removed entities despawn actors (with exit animation)
- Changed entities update mood, state, currentTask incrementally
- No full-page reload needed

### 13 — Task Execution Wiring (L, must)

**Scope:** Full lifecycle from panel assignment to completion.

**Acceptance Criteria:**
- Panel task assignment sends POST to `/api/agent/task`
- CLI receives task, agent runner picks it up
- Game agent walks to workstation, enters working state
- LLM output streams back via SSE
- On completion, agent returns to idle, task marked done
- Error/timeout states handled gracefully

### 10 — CLI as Universal Report Engine (XL, must)

**Architectural decision:** Move away from per-project scripts. CLI provides baseline report generation tools that work for any managed project.

**Acceptance Criteria:**
- CLI provides built-in generators for: test, coverage, codebase, complexity, status, summary
- Generators work against any project with `reports` config — not hardcoded to CLI internals
- Plugin config references CLI generators by ID instead of custom scripts
- Plugin-specific generators (cycle, performance, trace, e2e) either become CLI built-ins or project-local overrides
- `flowti reports --project="Flowti Plugin"` produces all reports without `scripts/` dependency
- Report frontmatter follows standard format (`type`, `date`, `project`)

## Decisions

- Plugin Health Snapshot is already functional — dropped from backlog
- Plugin Config Schema Alignment refined from 15 gaps to 4 actual gaps (S instead of M)
- Agent World joy items (particles, emotes, glow, proximity) are must-haves for product launch — core to value thesis, not polish
- CLI becomes the universal report engine — Plugin drops custom scripts in favor of CLI-provided generators
- LLM Provider Abstraction already in-progress — no refinement needed
- Inbox triage deferred to post-launch (Iteration 6+ planning)

## Effort Summary

| Priority | Items | Estimated Effort |
|----------|-------|-----------------|
| Active (in-progress) | 7 | ~3S + 2M + 2L + 1XL |
| Must (refined) | 8 | 2S + 3M + 2L + 1XL (~30-40h) |
| Could (deferred) | 1 | 1L |
| **Total launch effort** | **15** | **~60-70h** |

## Critical Path

1. Fix Plugin views (active) → enables all Plugin work
2. Config alignment (S) + Bootstrap management (M) → Plugin becomes fully managed
3. Dashboard data+sync+tasks (S+L+L) → live, functional dashboard
4. Joy polish (M+M) → product delight
5. Report engine (XL) → platform capability

## Carry-Over

- Inbox triage (579 items) → Iteration 6 planning
- Agent World Tier 3 items (day/night cycle, ambient events, cross-room transitions) → Iteration 6+
