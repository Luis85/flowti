---
type: RefinementSession
date: 2026-03-17
iteration: 5
focus: Agent World — Joy, Feel, and Live Integration
itemsReviewed: 21
itemsRefined: 21
consultants:
  - UX Designer (Sage)
  - Game Designer (new agent)
---

# Backlog Refinement — 2026-03-17 — Agent World

## Summary

- Items reviewed: 21
- Items refined: 21
- Items split: 0
- Items rejected: 0
- New agent created: Game Designer (roster gap identified)
- Consulting agents: UX Designer (Sage), Game Designer (new)

## Value Thesis

The agent world's value isn't "a dashboard that moves." It's **a place you want to visit**. Joy items that make the world feel alive are the core product — not polish. Infrastructure items (data export, reconciliation, task wiring) are pipes that enable joy to flow from real data.

## Context

**Iteration 5 Phase B** delivered the ExcaliburJS RPG world through 4 executed plans:
1. `excalibur-rpg-environment` — CLI foundation (multi-listener, data model, server endpoints, SSE)
2. `excalibur-rpg-phase-b2` — Pixel-art agents, room scenes, panel integration, sync system
3. `excalibur-rpg-phase-b3` — Agent habits (personality-driven movement), camera follow
4. `ninja-adventure-sprites` — Real sprite characters (86 Ninja Adventure characters)

**Current state:** 39 source files, 19 test suites (156 tests), 5 scenes, brain-driven wandering AI with habit personalities, Lit-based panel UI (5 tabs), SSE event stream, camera follow, bubble system, talk engine, doorways, roster bar.

**Gaps identified:** Data export incomplete, world state reconciliation stubbed, task execution visual-only, no "game feel" / juice, agents lack emotional expressiveness.

**Design consultation:** UX Designer (Sage) and Game Designer contributed joy-focused items. Key insight: three highest-impact changes are particle footsteps (physical presence), proximity conversations (social "aha moment"), and workstation glow (productivity visibility).

## Refined Items

### Tier 1 — MUST

| # | Item | Estimate | Priority | AC Summary |
|---|------|----------|----------|------------|
| 1 | Worktree merge | S | must | Feature branch created, tests pass, build succeeds, merged to master, worktree cleaned |
| 2 | Update stale iteration plan | S | must | B1-B10 checkboxes reflect reality, Phase B Delivery Notes added |
| 3 | Particle footsteps + dust puffs | S | must | Walking agents leave fading trails, dust burst on arrival |
| 4 | Mood emotes (floating sprites from assets/Ui/Emote/) | S | must | Periodic emote icons float above agents based on mood field |
| 5 | Workstation screen glow + activity sparks | S | must | Active workstations glow, spark particles on tool-use events |
| 6 | Proximity conversations | M | must | Nearby related agents spontaneously talk with personality-driven dialogue |
| 7 | Data export gap (5 missing fields) | S | must | Game DashboardAgent gains goals, behaviors, project, iteration, phase |
| 8 | World state reconciliation (diff → spawn/despawn) | L | must | onStateDiff handler processes added/removed/changed entities |
| 9 | Task execution wiring (dashboard → CLI → SSE → game) | L | must | Full lifecycle: assign → walk-to → work → LLM output → completion |

### Tier 2 — SHOULD

| # | Item | Estimate | Priority | AC Summary |
|---|------|----------|----------|------------|
| 10 | Arrival fanfare (staggered walk-in on boot) | S | should | Agents walk in from doorways, staggered 300ms each |
| 11 | Discovery tooltips on hover | S | should | Compact floating card on 500ms hover with name, state, mood |
| 12 | Agent reputation aura (XP-based glow) | S | should | Bronze/silver/gold glow ring based on experience thresholds |
| 13 | currentTask derivation from session/brief | M | should | CLI exports currentTask, game shows in panel + tooltip |
| 14 | E2E backend integration test | M | should | Script verifies flowti serve → SSE → brain transition → bubble |
| 15 | Test coverage gaps (4 test suites) | L | should | brain-system, bubble-system, talk-engine, sync-system tested |

### Tier 3 — COULD (Iteration 6 candidates)

| # | Item | Estimate | Priority | AC Summary |
|---|------|----------|----------|------------|
| 16 | Day/night ambient cycle | M | could | 10-min light loop, workstation glow brightens at night |
| 17 | Ambient world events (micro-narratives) | M | could | Random personality-flavored observations every 60-120s |
| 18 | Agent social interaction beyond facing | M | could | Extended social behaviors from B3 non-goal |
| 19 | Cross-room agent transitions | L | could | Occasional doorway visits, return to home room |
| 20 | "Back from break" stretch animation | S | could | Transitional pose + thought bubble on work→wander |
| 21 | Create Game Designer agent | S | must | New agent in roster for ongoing world refinement |

## Detailed Acceptance Criteria

### #1 — Worktree Merge (S, must)

- [ ] All agents work committed to feature branch `feat/iter-5/excalibur-rpg-world`
- [ ] Tests pass: 19 files, 156+ tests green
- [ ] Build succeeds: dashboard output in `.flowti/agents/`
- [ ] Branch merged to master (no conflicts or conflicts resolved)
- [ ] Worktree `ws-plan-excalibu-k6e2` cleaned up

### #2 — Update Stale Iteration Plan (S, must)

- [ ] Phase B scope items updated to reflect what was actually built (sprites, Lit panels, habits, camera, bubbles, talk engine)
- [ ] Completed items checked off, superseded items updated
- [ ] "Phase B Delivery Notes" section added documenting evolution: B1 spec → B2 pixel-art → B3 habits → Ninja sprites → current state
- [ ] References to all 4 executed plan files

### #3 — Particle Footsteps + Dust Puffs (S, must)

- [ ] Walking agents (wandering + walking-to) leave fading 1-2px dot trails in body color
- [ ] Trail dots fade out over 2 seconds
- [ ] Walking-to trails are more visible than wandering trails (higher opacity)
- [ ] Dust puff particle burst (4-6 particles, spread + fade) on arrival at destination
- [ ] New `particle-system.ts` manages lightweight particle actors with opacity timers
- [ ] Particle count bounded to prevent memory issues (max 200 active particles)
- [ ] Tests: particle creation, fade lifecycle, arrival burst trigger

### #4 — Mood Emotes (S, must)

- [ ] Periodic emote icons float above agents based on `mood` field
- [ ] Uses existing `assets/Ui/Emote/` PNG sprites (currently unused)
- [ ] Mood-to-emote mapping: happy→hearts/stars, frustrated→storm clouds, focused→lightbulb, etc.
- [ ] Float-up-and-fade animation: 2-second duration, rises 20px, opacity 1→0
- [ ] Frequency driven by WIS-derived `quoteFrequency` from `BrainParams` (every 20-40s)
- [ ] Only shows when agent is idle or on-break (not during active movement)
- [ ] New `emote-system.ts` with per-agent cooldown timers
- [ ] Tests: emote selection by mood, cooldown enforcement, idle-only constraint

### #5 — Workstation Screen Glow + Activity Sparks (S, must)

- [ ] Occupied workstations emit soft pulsing glow matching room theme color
- [ ] Empty workstations remain dim (current behavior)
- [ ] While agent is in "working" state at workstation, tiny spark particles (1px colored dots) float upward every 2-3s
- [ ] On `using-tool` SSE event: burst of sparks (more particles, briefly)
- [ ] Glow is a radial gradient behind the monitor graphic, pulses on sine wave
- [ ] Reuses particle-system.ts from item #3
- [ ] Tests: glow toggle on occupy/vacate, spark rate, tool-burst trigger

### #6 — Proximity Conversations (M, must)

- [ ] When two agents with a `relationship` are within `socialRadius` for > 4s, one initiates a conversation
- [ ] Both agents enter `talking` state, face each other, show speech bubbles with personality-flavored lines
- [ ] Conversation lasts 3-5s, then both return to idle
- [ ] Frequency modulated by CHA attribute (high CHA = more conversations)
- [ ] Per-pair cooldown prevents the same two agents from chatting repeatedly (60s minimum)
- [ ] Conversation text drawn from personality traits + relationship type
- [ ] New `social-system.ts` that checks pairwise distances among agents with relationships
- [ ] Tests: proximity trigger, cooldown enforcement, CHA frequency scaling, brain state transitions

### #7 — Data Export Gap (S, must)

- [ ] Game-side `DashboardAgent` in `agents/src/data/types.ts` adds: `goals?: readonly { text: string; priority: string }[]`, `behaviors?: readonly string[]`, `project?: string`, `iteration?: string`, `phase?: string`
- [ ] `panel-info.ts` displays project/iteration/phase when present
- [ ] `panel-info.ts` displays goals and behaviors when present
- [ ] No runtime errors when fields are absent (backward compat)

### #8 — World State Reconciliation (L, must)

- [ ] `onStateDiff` handler in `main.ts` processes `added` entities — spawns new agents into correct room scene
- [ ] Processes `removed` entities — despawns agents from their scene
- [ ] Processes `changed` entities — updates agent status, triggers brain transition + bubble
- [ ] Status changes announced with speech bubble ("I'm now busy on Iteration #5!")
- [ ] Idempotent: same data arriving multiple times doesn't create duplicates
- [ ] New `sync-system.test.ts` covering diff scenarios
- [ ] Graceful handling when server is unreachable (no crash, reconnect status shown)

### #9 — Task Execution Wiring (L, must)

- [ ] `/api/agent/task` POST triggers actual agent runner execution in CLI
- [ ] SSE events flow back: `task-started` → `thinking` → `speaking`/`tool-complete` → `task-completed`
- [ ] Game reflects full lifecycle: walking-to workstation → working → thought bubbles from LLM → speech on completion → idle
- [ ] Error case: `error` SSE event triggers error bubble
- [ ] Panel-talk tab shows streaming output from agent execution
- [ ] Visual feedback immediate (optimistic), reconciled when SSE events arrive

### #10 — Arrival Fanfare (S, should)

- [ ] On initial load, agents walk in from nearest doorway instead of spawning in place
- [ ] Staggered by 300ms per agent for "filing in" effect
- [ ] First personality quote shown as speech bubble on arrival at spawn position
- [ ] New agents added via world-state diff also get walk-in treatment

### #11 — Discovery Tooltips on Hover (S, should)

- [ ] 500ms hover over agent shows compact floating card
- [ ] Card shows: name/persona, role, human-readable brain state ("Deep in focus", "Taking a stroll"), mood-colored border
- [ ] Card follows cursor, disappears on mouseout
- [ ] Click still opens full panel (tooltip dismisses)
- [ ] DOM overlay managed by `tooltip-system.ts`

### #12 — Agent Reputation Aura (S, should)

- [ ] Experience-based glow ring: 0-49 = none, 50-99 = bronze, 100-199 = silver, 200+ = gold
- [ ] 1-2px ring with sine-wave opacity oscillation (reuses bobPhase pattern)
- [ ] Visible at a glance without clicking
- [ ] Aura color rendered as additional canvas layer in `AgentActor`

### #13 — currentTask Derivation (M, should)

- [ ] CLI `buildDashboardAgent()` derives `currentTask` from active session or latest open brief
- [ ] Game-side `DashboardAgent` adds `currentTask?: string`
- [ ] Shown in panel-info and discovery tooltip
- [ ] Test: derivation from session, from brief, and absent case

### #14 — E2E Backend Integration Test (M, should)

- [ ] Integration test: start `flowti serve`, send task via API, verify SSE received, verify brain state
- [ ] SSE reconnection tested: kill/restart server, verify reconnect
- [ ] Document manual smoke-test procedure

### #15 — Test Coverage Gaps (L, should)

- [ ] `brain-system.test.ts` — state transitions, timer wander, clampToBounds, targetBounds, freeze/applyEvent
- [ ] `bubble-system.test.ts` — show/dismiss lifecycle, queue, ambient quotes
- [ ] `talk-engine.test.ts` — register/silence, ambient talk timing
- [ ] `sync-system.test.ts` — boot from dashboard, poll cycle, SSE routing, diff handling
- [ ] All 4 new test files pass

### #16-20 — Could Items (Iteration 6)

Acceptance criteria to be refined in next session.

### #21 — Create Game Designer Agent (S, must)

- [ ] New file `03 - Resources/Agents/game-designer.md`
- [ ] Type: Agent, agentType: ai, domain: design
- [ ] Skills: Game Feel|expert, Level Design|advanced, Reward Systems|advanced, Narrative Design|advanced, Player Psychology|expert
- [ ] Persona, personality, and attributes reflecting "juice and emergent behavior" perspective
- [ ] Registered in iteration plan agents list

## Decisions

- Joy items prioritized as Must-tier alongside infrastructure — they ARE the product value, not polish
- Game Designer agent created to fill roster gap for ongoing world refinement
- Items 7-8 from B3 non-goals (social interaction, cross-room) moved to Could tier (Iteration 6 candidates)
- Three highest-impact joy items (particles, emotes, glow) are all S-sized — front-loaded for fast wins
- Proximity conversations elevated to Must despite M size — it's the "aha moment" that transforms the world

## Polish Backlog (discovered during implementation)

- Particle trail density may need tuning after visual review (currently 8px threshold)
- Emote system uses thought bubbles instead of actual emote sprite float-up actors (pending emote sprite loading)
- Workstation spark particles on `using-tool` SSE event not yet wired
- Social conversation lines are generic — extend with domain-specific + personality-flavored variants
- Emote sprite float-up animation (load actual PNGs from assets/Ui/Emote/) instead of text bubbles

## Bob: World Narrator & Player Interface

**Priority:** Must — next implementation target
**Estimate:** L (4-8h)

### Concept

Bob is the **single LLM agent** behind ALL agent interactions in the world. Instead of each agent having its own LLM session (expensive, wasteful), Bob acts as:

1. **Narrator** — generates ambient dialogue, impersonates agents during proximity conversations, provides personality-flavored quotes
2. **World observer** — always knows the full world state (agent positions, brain states, tasks, moods, relationships)
3. **Player interface** — the "Ask Bob" button lets the user talk to Bob directly. Bob answers as himself (cheerful, approachable) about what's happening in the world

### Architecture

```
User clicks "Ask Bob"
       ↓
  Bob LLM session (single, persistent)
       ↓
  System prompt includes:
    - Bob's personality (cheerful, curious, never judges)
    - Current world state snapshot (all agents, positions, states, moods)
    - Recent activity log (last 20 events)
    - Agent roster with personalities/skills/relationships
       ↓
  Bob responds as himself, OR
  Bob impersonates an agent (when user talks to agent via panel-talk)
```

### "Ask Bob" UI

- Floating button in bottom-left corner (opposite the roster bar)
- Opens a persistent chat overlay (not in the agent panel — it's global)
- Bob's responses include world-state awareness: "Sage and Luna are chatting near the village forge right now" / "The Tech Lead has been working for 5 minutes straight"
- Bob can narrate ambient events: "Looks like Pixel just finished a break and is heading back to the console"

### Impersonation Mode

When user sends a message via panel-talk to any agent, Bob receives:
- The target agent's full definition (persona, personality, mood, skills, goals)
- Instruction: "Respond as [agent name] in character"
- World state context for that agent

This means ONE LLM session handles all talk-tab conversations, just with different system prompt overlays.

### Acceptance Criteria

- [ ] "Ask Bob" button visible in dashboard UI (bottom-left, above roster bar)
- [ ] Clicking opens a persistent chat overlay with Bob's persona
- [ ] Bob receives world state snapshot on each message (agent positions, states, moods)
- [ ] Bob can answer questions about what agents are doing
- [ ] Panel-talk messages route through Bob with impersonation prompt
- [ ] Bob's responses appear as agent speech bubbles in the world
- [ ] Single LLM session — no per-agent API calls

## Carry-Over

- Tier 3 items (16-20) deferred to Iteration 6 planning
- Should-tier items (10-15) scheduled if capacity allows after Must tier complete

## Estimated Capacity

| Tier | Items | Estimate |
|------|-------|----------|
| Must | 9 + agent | ~22h |
| Should | 6 | ~14h |
| Could | 5 | ~14h |
| **Total** | **21** | **~50h** |
