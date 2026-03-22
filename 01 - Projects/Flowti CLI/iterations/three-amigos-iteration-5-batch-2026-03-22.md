---
type: ThreeAmigosReview
iteration: 5
scopeItem: "Batch review — all open items"
date: 2026-03-22
aligned: true
---

# Three Amigos Review — Iteration 5 Batch (All Open Items)

## Context

Full-polish pass completed same day: 924 TSC errors resolved, 87 test failures fixed, 16,325 tests passing across CLI (6,766) and Plugin (9,559). LLM session management merged to master. This review covers all remaining open scope items with 6 days until iteration end (2026-03-28).

## Items Reviewed

### Phase D: BT→Brain Autonomous Behavior — MARKED DONE

All 7 BT→Brain wiring items are implemented and tested:
- `seek-food`, `seek-drink`, `seek-rest`, `seek-merchant`, `seek-agent`, `seek-quiet`, `break`
- Brain event map, BT extensions, and engine-simulation bubble handlers all in place
- `seek-food` and `seek-drink` added to `AgentActionType` union during polish pass

**Product Owner:** Core "agents feel alive" promise delivered.
**Architect:** Consistent wiring pattern across all actions. Movement targets are generic (`kind: "custom"`) — station-seeking is preference-based via separate BT nodes.
**Tester:** Unit tests exist in `bt-agent-extensions.test.ts` and `engine-simulation.test.ts`. Live verification deferred to testing session.

### Phase E: Brain-Initiated LLM Sessions — IN SCOPE (attempt)

4 items: brain-requested sessions, concurrent limits, decay timer, decoupled acquisition.

**Product Owner:** Bridge between "agents look alive" and "agents ARE alive." High value, accepted risk of building on fresh session foundation.
**Architect:** Depends on live-validated session management. Risks: conversation history always `[]`, "thinking" state unreachable. Recommended deferral was overridden — proceeding with awareness.
**Tester:** Needs unit tests for session pool + BT integration. End-to-end requires live testing first.

**Acceptance Criteria:**
- [ ] Given BT evaluates "execute-task" as ready, brain autonomously acquires LLM session
- [ ] Given `maxConcurrent: 2` and 3 agents requesting, only 2 active, 1 queues
- [ ] Given brain-initiated session completes, decay timer fires and releases cleanly
- [ ] Session acquisition works for any spawned worker, not just user-triggered ones

### Live Testing & Validation — SCHEDULED (focused session)

4 live test sessions: LLM sessions, Task & Economy, Interactions, Visual overhaul.

**Product Owner:** Validation gates, not features. Must run before Phase E.
**Architect:** Manual verification — build CLI + Plugin, run in Obsidian, exercise features.
**Tester:** Interactive exploratory testing with checklist. Not automatable.

**Test Checklist:**
- [ ] LLM sessions: spawn agent → verify priming → second message (reuse) → stop (decay) → timeout → cleanup
- [ ] Task & Economy: assign task → verify XP reward → check coin → verify trust level
- [ ] Interactions: click agent → panel opens → send message → verify response
- [ ] Visual overhaul: BT drives behavior → debug panel correct → merchant stall clickable

### Phase B Gaps — 3 ITEMS IN SCOPE

**In scope:**
- [ ] Task execution: wire Plugin "assign task" → CLI worker manager via API → stream output back
- [ ] Data export: add `goals`, `behaviors`, `project`, `iteration`, `phase` to DashboardAgent
- [ ] World state reconciliation: implement `onStateDiff` handler

**Deferred to Iteration 6:**
- Game feel (particles, emotes, workstation glow)
- Social interaction (proximity conversations)
- Interactive waiting (small talk during LLM generation)

**Product Owner:** Task execution is highest value — connects world to real work.
**Architect:** Task execution is cross-project integration (CLI↔Plugin via API). Highest risk item.
**Tester:** Needs end-to-end testing across CLI↔Plugin boundary. Requires live session.

**Acceptance Criteria (Task Execution):**
- [ ] Given user assigns task in Plugin panel, CLI worker manager receives and spawns LLM
- [ ] Given LLM generates output, Plugin receives streamed response via SSE
- [ ] Given task completes, agent transitions from "working" to "idle" with completion bubble

### Phase C0: Plugin View Hardening — IN SCOPE

**Product Owner:** Defensive quality — prevents crashes and degraded UX.
**Architect:** Focus on edge cases in view lifecycle: mount/unmount races, error recovery, graceful degradation.
**Tester:** Edge case testing: rapid tab switching, view disposal during async operations, error states.

**Acceptance Criteria:**
- [ ] Plugin views handle rapid mount/unmount without errors
- [ ] Async operations cancel gracefully when view is disposed
- [ ] Error states show user-friendly messages, not stack traces

### Phase C3: Flowti CLI View — IN SCOPE (attempt, may not ship)

**Product Owner:** Biggest UX opportunity — CLI accessible from Obsidian. Accepted risk of partial delivery.
**Architect:** Multi-week effort compressed. Needs: view registration, terminal emulation, process management, bidirectional comms. Likely partial.
**Tester:** New test suite needed for view lifecycle. Major untested surface area if rushed.

**Acceptance Criteria (minimum viable):**
- [ ] Flowti CLI View registers in Obsidian sidebar
- [ ] CLI Hub tab shows available commands
- [ ] At least one command can be executed and output displayed
- [ ] Agents Hub tab shows agent roster from dashboard store

### Deferred to Iteration 6

- Phase C4: Skill Execution from Plugin (ribbon icon, skill picker, bidirectional streaming)
- Game feel: particles, emotes, workstation glow
- Social interaction: proximity conversations
- Interactive waiting: small talk during LLM generation

## Execution Priority

1. **Mark Phase D done** (this review)
2. **Live testing session** — validates sessions, economy, interactions, visuals (P0)
3. **Phase E** — brain-initiated sessions, builds on validated foundation (P1)
4. **Phase B gaps** — task execution, data export, world state reconciliation (P1)
5. **Phase C0** — Plugin view hardening (P2)
6. **Phase C3** — Flowti CLI View, attempt if time permits (P3)

## Alignment

- **Status:** Aligned
- **Key tension resolved:** Architect recommended deferring Phase E; Product Owner overrode to attempt this iteration with acknowledged risk. Live testing gates Phase E.
- **Key tension resolved:** Architect flagged C3 as multi-week; Product Owner accepted risk of partial delivery.
- **All three perspectives agree on:** execution order, stretch deferrals, live testing as prerequisite
