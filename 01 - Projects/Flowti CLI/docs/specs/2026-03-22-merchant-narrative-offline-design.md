# Merchant, Narrative & Offline Progress — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Iteration:** Post-Increment 2, bridging to Increment 3
**Depends on:** Economy domain (Phase A complete), Vault Operations (Phase B complete), Rich Dialogue (in-flight), Interaction System (in-flight)

## Overview

Three features that close the economy loop and add idle-game magic:

1. **Merchant NPC** — Director buys capabilities/items for agents. Progressive: agents gain auto-purchase at higher trust tiers.
2. **Offline Progress** — Bounded simulation of up to 8 hours of agent work. Narrative briefing on return.
3. **Emergent Narrative Log** — Each day cycle generates a vault markdown story. Running feed in-game, permanent record in vault.

### What This Does NOT Include

- Task Routing / WorkerManager (deferred)
- Process Pool / capacity limits (deferred)
- Pet Utility Roles (deferred)
- Full agent autonomous purchasing UI (deferred — auto-purchase via BT only)

### Dependencies on In-Flight Work

- Rich Dialogue system provides phrase templates the narrative briefing uses
- Interaction System provides the event bus the narrative log subscribes to
- Both are additive — this iteration can ship independently and integrate when those land

## 1. Merchant NPC — Game Side

### 1.1 Architecture

The CLI already owns the data: `merchant-catalog.ts` (catalog CRUD), `shop.controller.ts` (list/buy/catalog:add/catalog:edit), `economy-ledger.ts` (coin debit).

**New Plugin files:**
- `src/game/systems/merchant-system.ts` — Coordinates purchase flow, reads catalog, validates affordability, calls CLI commands
- `src/game/ui/merchant-panel.ts` — Lit component: shop catalog UI when Director clicks Merchant stall

**Modified Plugin files:**
- `src/game/actors/merchant-stall.ts` — Add click handler to open merchant panel
- `src/game/brain/behavior-tree/bt-agent.ts` — Add `[MerchantVisit]` subtree for auto-purchase (trust-gated)
- `src/game/store/dashboard-store.ts` — Add merchant catalog state + purchase events

### 1.2 Purchase Flow (Director)

```
Director clicks Merchant stall
  → MerchantPanel opens (Lit component)
    → Shows catalog filtered by selected agent's level
      → Director selects item + agent
        → MerchantSystem validates: agent has enough Coin, meets level requirement
          → Calls CLI: flowti shop:buy --agent=<name> --item=<id>
            → CLI debits Coin, records transaction
              → Plugin receives confirmation via CLI stdout
                → Particle effect (coin trail to stall), notification bubble
                  → Agent's capability list updated in DashboardStore
```

### 1.3 Auto-Purchase Flow (Progressive Trust)

When an agent reaches Level 5+ with "trusted" tier:

- BT gains a `[MerchantVisit]` subtree (low priority, checked once per day cycle)
- Agent walks to Merchant stall, "browses" for 3-5 seconds
- Checks if any affordable capability items would unlock new task types
- If yes: auto-purchases, Director gets notification bubble
- If no: agent leaves, tries again next cycle

### 1.4 Merchant Panel UI

A simple catalog view:

- Agent selector dropdown (last-selected agent or Director's current selection)
- Catalog grid: item name, category icon, cost, level requirement, owned badge
- Buy button (disabled if insufficient Coin or already owned for one-time items)
- Agent's current balance shown at top
- Category tabs: Capability | Resource | Cosmetic | Pet Cosmetic | Room (matches `ShopCategory` type: `"capability" | "resource" | "cosmetic" | "pet-cosmetic" | "room"`)

### 1.5 Merchant Data Flow

```
CLI (data authority)              Plugin (presentation + interaction)
├── merchant-catalog.json         ├── MerchantSystem (reads catalog)
├── economy.json (balances)       ├── MerchantPanel (displays UI)
├── shop:buy (transaction)        ├── DashboardStore (reactive state)
└── economy-log.jsonl (audit)     └── BT [MerchantVisit] (auto-buy)
         │                                    │
         └──── CLI child process (stdout JSON) ─┘
```

Note: The GDD's architecture diagram shows an SSE bridge — that is aspirational. The actual transport is CLI child processes with JSON stdout, matching the `CliDataProvider` pattern used throughout the Plugin.

## 2. Offline Progress

### 2.1 Architecture

**New Plugin files:**
- `src/game/systems/offline-progress.ts` — Calculates what happened while away, runs bounded simulation
- `src/game/ui/briefing-panel.ts` — Lit component: narrative briefing on return

**Modified Plugin files:**
- `src/game/engine-lifecycle.ts` — Call offline progress on startup, before first tick
- `src/game/store/dashboard-store.ts` — Add offline results state

### 2.2 Startup Flow

```
Obsidian opens → Plugin loads → Engine initializes
  → Read `lastUpdated` field from .flowti/var/world-clock.json (set by existing flushWorldState on shutdown)
    → Calculate elapsed: Date.now() - lastUpdated
      → If < 5 minutes: skip (just a reload)
      → If 5 min – 8 hours: run bounded simulation
      → If > 8 hours: simulate 8 hours + apply "rested" bonus
        → Generate offline results summary
          → Pass to Narrative System for story generation
            → BriefingPanel opens with Merchant NPC greeting
              → Player dismisses → normal gameplay begins
```

### 2.3 Bounded Simulation

A lightweight loop that processes compressed day cycles — not full game ticks:

```typescript
interface OfflineResults {
	readonly elapsedMs: number;
	readonly simulatedMs: number;            // capped at 8 hours (28,800,000 ms)
	readonly cyclesSimulated: number;         // max ~19 (8h / 25min per cycle)
	readonly agentResults: readonly AgentOfflineResult[];
	readonly rested: boolean;                // true if elapsed > 8h
}

interface AgentOfflineResult {
	readonly name: string;
	readonly tasksCompleted: number;
	readonly xpEarned: number;
	readonly coinEarned: number;
	readonly leveledUp: boolean;
	readonly previousLevel: number;
	readonly currentLevel: number;
	readonly needsRestored: boolean;
}
```

**Per-cycle simulation:**

1. Each agent with assigned tasks "completes" one task per cycle (based on historical average from economy ledger, or 1 if no history)
2. XP/Coin credited per task using existing `calculateReward()` rules
3. Level-ups checked via `levelForXp()`
4. Needs reset to mid-range values (agents ate, drank, rested during the simulated day)
5. Standing orders trigger once per cycle if conditions match

**What it does NOT simulate:**

- No relationship changes (social requires real-time proximity)
- No trust promotions (Director should witness those)
- No vault file operations (file mutations should not happen silently)
- No pet interactions (pets are ambient, not productive)

### 2.4 Rested Bonus (>8 hours)

When elapsed time exceeds the 8-hour simulation cap:

- All agent needs set to full (energy 100, hunger 100, thirst 100, focus 80, social 60, morale 80)
- +10% XP bonus on first 3 tasks after return ("well-rested productivity")
- Narrative mentions the rest: "The team took some well-deserved downtime."

### 2.5 Persistence

- Offline results written to `.flowti/var/offline-results.json` (overwritten each session)
- Economy ledger updated via CLI command: `flowti economy:grant --agent=<name> --coin=<n> --xp=<n>` per agent (preserves CLI as data authority — Plugin never writes to economy files directly). A new `--reason="offline-progress"` flag tags the transaction type.
- World clock `lastUpdated` already set by existing `flushWorldState()` on shutdown — no additional write needed
- Narrative vault files generated for simulated cycles

## 3. Emergent Narrative Log

### 3.1 Architecture

**New Plugin files:**
- `src/game/systems/narrative-system.ts` — Collects events during day cycle, composes story at day-end, writes vault markdown
- `src/game/data/narrative-templates.ts` — Story fragment templates organized by event type

**Modified Plugin files:**
- `src/game/systems/day-clock.ts` — Add `onCycleEnd(cb)` callback. The existing DayClock has `onPhaseChange` but no end-of-cycle signal. When the cycle wraps (before emitting `morning-arrival`), call registered `onCycleEnd` listeners. The narrative system registers here to compose the day's story.
- `src/game/engine-events.ts` — Wire narrative system to event sources

### 3.2 Event Collection

The narrative system subscribes to game events throughout the day cycle, collecting "story beats":

```typescript
interface StoryBeat {
	readonly timestamp: number;          // ms into the day cycle
	readonly phase: string;              // "morning" | "lunch" | "afternoon" | etc.
	readonly category: "task" | "social" | "need" | "economy" | "pet" | "ritual";
	readonly actors: readonly string[];  // agent/pet names involved
	readonly event: string;              // e.g. "task-completed", "conversation", "steal-food"
	readonly detail: Record<string, unknown>;
}
```

**Events collected:**

| Category | Events |
|----------|--------|
| task | task-completed, task-assigned, task-rejected, standing-order-triggered |
| social | conversation, cluster-formed, cluster-dissolved |
| need | need-critical (hunger/thirst/energy), need-restored |
| economy | level-up, trust-promoted, merchant-purchase, reward-earned |
| pet | steal-food, share-food, bonding, zoomies |
| ritual | standup-completed, retro-completed, celebration |

Note: Merchant events (purchase, browse) are categorized under `economy`. No separate `merchant` category — avoids duplicate beat recording.

### 3.3 Story Composition

At cycle end (`onCycleEnd` callback), story beats become prose:

1. **Group beats by narrative phase** — map DayPhases to 5 narrative sections:
   - Morning = `morning-arrival` + `productive-morning`
   - Lunch = `lunch`
   - Afternoon = `afternoon` + `afternoon-slump`
   - Wind-Down = `wind-down`
   - Evening = `evening-departure`
2. **Rank by significance** — level-ups and trust promotions are headlines; routine tasks are background color
3. **Select templates** from `narrative-templates.ts`, fill with actor names + details
4. **Connect with transitions** — "Meanwhile...", "Later that afternoon...", "As the day wound down..."
5. **Add personality color** — Reference agent quirks/relationships for flavor

**Template examples:**

```
// Task completion
"${agent} completed ${count} ${domain} tasks, earning ${xp} XP${levelUp ? ` and reaching Level ${level} (${title})!` : '.'}"

// Social
"${agent1} and ${agent2} shared a ${drink} at the water cooler — their friendship growing stronger."

// Pet
"${pet} stole ${agent}'s snack again. ${agent} didn't seem to mind this time."

// Level-up (headline)
"The highlight of the day: ${agent} reached Level ${level} — ${title}! Nearby agents paused to celebrate."

// Merchant
"${agent} visited the Merchant and picked up ${item}. ${reaction}"
```

### 3.4 Vault Output

Written to `03 - Resources/Narrative/{date}-day-{cycle}.md`:

```markdown
---
type: NarrativeLog
date: 2026-03-22
cycle: 47
agents: [Auditor, Writer, Designer]
highlights: [level-up, trust-promoted]
offline: false
---

# Day 47 — A Productive Tuesday

## Morning
The team arrived in good spirits. Auditor dove straight into tagging inbox notes...

## Lunch
Writer and Designer had a long conversation about the project roadmap...

## Afternoon
The highlight came at 2pm — Auditor reached Level 4 (Artisan)! Nearby agents paused to celebrate...

## Evening
As the day wound down, the team's combined output: 12 tasks completed, 340 XP earned.
```

### 3.5 In-Game Display

The current day's narrative renders in a scrollable text area — either part of the existing info panel or a "Journal" tab. It updates live as beats are collected, showing the latest few entries as a running feed. The composed full story appears at day-end.

### 3.6 Integration with Offline Progress

When offline progress simulates cycles, each generates a condensed narrative:

- Condensed format: "During the night, the team quietly worked through 47 tasks across 12 cycles."
- Individual highlights still called out: "Writer hit Level 3 while you were away."
- Written as vault files with `offline: true` in frontmatter
- Multiple offline cycles may be merged into a single narrative file

## 4. Narrative Briefing (The Return Experience)

### 4.1 Purpose

Ties Merchant, Offline Progress, and Narrative together into the "welcome back" moment. The Merchant NPC narrates what happened while the player was away.

### 4.2 Briefing Content

The Merchant NPC delivers 3 sections in a personality-flavored voice:

**1. Headlines (1-3 lines)** — Most significant events:
- *"Welcome back, Director. Big news — Auditor hit Level 4 while you were away. About time, if you ask me."*

**2. Summary stats (compact)** — Time away, tasks completed, XP/Coin earned:
- *"Your team handled 47 tasks across 12 cycles. Total haul: 1,240 XP and 620 Coin."*

**3. Color commentary (1-2 lines)** — Personality observation about relationships, pets, quirks:
- *"Oh, and the cat knocked over the coffee machine. Twice. Designer thought it was hilarious."*

If away > 8 hours, add rested note:
- *"The team took some downtime too — everyone's well-rested and ready to go."*

### 4.3 Briefing Panel UI

A modal-style Lit component:

- Merchant NPC portrait/icon at top
- Narrative text (3 sections)
- "View Full Report" link → opens the narrative vault file
- "Dismiss" button → closes panel, normal gameplay starts
- Auto-dismiss after 30 seconds if no interaction (non-intrusive per GDD)

### 4.4 Template Source

Briefing templates live in `narrative-templates.ts` alongside story templates. The Merchant's voice is one template set — a future NPC could narrate differently.

### 4.5 When No Briefing

- Away < 5 minutes: no briefing, no simulation, game resumes normally
- No assigned tasks during offline period: briefing shows "Quiet day — no tasks in the queue" instead of stats

## 5. Persistence & Data Flow

### 5.1 New Files

| File | Content | Written by |
|------|---------|-----------|
| `.flowti/var/offline-results.json` | Last offline simulation results | offline-progress system |
| `03 - Resources/Narrative/{date}-day-{cycle}.md` | Day narrative with YAML frontmatter | narrative system |

### 5.2 Modified Files

| File | Change |
|------|--------|
| `.flowti/var/world-clock.json` | Already handled by existing `flushWorldState()` — no additional work |
| `.flowti/var/economy.json` | Updated via `flowti economy:grant` CLI command (not direct Plugin write) |
| `.flowti/var/economy-log.jsonl` | Updated via CLI command (same as above) |

### 5.3 Data Authority

CLI remains the data authority for economy, catalog, trust. Plugin reads via CLI commands (JSON output) and writes only to world-state files (positions, needs, clock, narrative).

## 6. Integration Points

### 6.1 With Rich Dialogue System (in-flight)

- Narrative briefing uses the same template composition patterns
- Agents can reference narrative events in conversations: "Did you see Auditor's level-up yesterday?"
- Story beats feed into the dialogue system's "recent event" awareness

### 6.2 With Interaction System (in-flight)

- InteractionBus events become story beats for the narrative system
- Merchant interactions (browse, purchase) emit events the narrative collects
- When Interaction System lands, narrative subscribes to InteractionBus instead of individual event sources

### 6.3 With Existing Systems

- **Economy**: reads balances for affordability checks, writes transactions via CLI commands (`shop:buy`, `economy:grant`)
- **Trust**: reads trust profiles for auto-purchase eligibility
- **Day Clock**: `onCycleEnd` callback triggers story composition
- **DashboardStore**: reactive state for catalog, offline results, current narrative

## 7. Test Strategy

All Plugin tests follow the existing Plugin test patterns.

| Test file | Scope |
|-----------|-------|
| `tests/game/systems/merchant-system.test.ts` | Purchase validation, catalog filtering, auto-purchase eligibility |
| `tests/game/systems/offline-progress.test.ts` | Simulation bounds, XP/Coin calculation, rested bonus, edge cases |
| `tests/game/systems/narrative-system.test.ts` | Beat collection, story composition, vault file output, template filling |
| `tests/game/ui/merchant-panel.test.ts` | UI state, buy button enable/disable, agent selection |
| `tests/game/ui/briefing-panel.test.ts` | Briefing content sections, auto-dismiss, no-briefing conditions |
