# Agent World — Game Design Document

> **Version:** 1.0
> **Date:** 2026-03-21
> **Status:** Living document — updated as systems are designed and implemented

---

## Vision

Agent World is an **idle game meets team dashboard meets agent observatory** embedded in Obsidian. Your AI agents do real vault work — tagging notes, creating documents, executing journeys — while you watch them live in a 2D pixel-art office world. Agents have personalities, relationships, needs, and an economy. You are the Director: you assign work, set budgets, tune trust levels, and occasionally intervene — but the world runs without you.

**The pitch:** "Your AI team works while you watch — or while you are away."

**The feel:** You open your vault and see your team of agents moving between rooms, chatting at the water cooler, grabbing coffee, working at their stations. A notification pops up: "Auditor finished tagging 12 inbox notes — earned 50 XP." You check the Merchant stall and buy Auditor a vault-write upgrade. Later, you notice the cat stole the dog's food bowl. You smile and get back to your own work.

---

## Core Principles

1. **No empty room problem** — AI agents are always present, unlike virtual offices (Gather.town, Teamflow) where rooms are empty without human users
2. **Real work output** — Agents produce code, tests, plans, tagged notes. The "game" has real stakes
3. **Ambient observation** — Checking on your team is a workflow that already exists; this makes it delightful
4. **Character-level focus** — Individual agent personalities, not system-level dashboards (RimWorld insight)
5. **Ambiguity in expression** — Let players project meaning onto agent behaviors (Sims GDC talk)
6. **Seed-and-watch mechanic** — Give a brief, watch agents coordinate (Stanford Smallville)
7. **Non-intrusive** — Never demand attention. Reward checking in, don't punish absence
8. **Compressed time** — A full "day" plays out in ~25 minutes so you see a complete cycle in one session

---

## Core Game Loops

### The Observation Loop (passive)

```
Open vault → Watch agents work/socialize → Notice something interesting
  → Click agent → See their stats/tasks/needs → Feel connection → Close
```

This is the idle game loop. It works with zero Director input. Agents autonomously work, eat, socialize, rest, and complete tasks. The world has rhythm (day cycle, lunch break, end-of-day bell) that makes checking in feel natural.

### The Director Loop (active)

```
Review task queue → Assign work to agents → Watch execution
  → Approve/reject reviewed output → See XP/Coin awarded
    → Buy capabilities from Merchant → Unlock new task types
      → Agents become more autonomous → Less Director input needed
```

This is the progression loop. The Director starts hands-on (reviewing every vault operation) and gradually grants autonomy as agents prove themselves. The game rewards trust with less work.

### The Economy Loop (progression)

```
Agent completes task → Earns XP + Coin
  → XP levels up agent → Unlocks capability eligibility
    → Coin buys capabilities from Merchant → Agent can do more
      → More tasks available → More XP/Coin earned
```

Two interleaving progression tracks: XP (leveling, automatic) and Coin (spending, player choice). Levels gate what you CAN buy. Coin gates what you DO buy. This creates build diversity — two agents at the same level can have different capability loadouts.

### The Sustenance Loop (needs)

```
Agent works → Hunger/thirst/energy decay
  → Agent seeks food/drink station → Needs restored
    → If neglected → Energy drains faster → Work slows
      → Pets compete for stations → Steal/share mechanic
```

Needs create rhythm and create situations. A hungry agent at the coffee machine. A pet stealing the snack table spot. An exhausted agent who skips lunch to finish a task. These emergent moments are the soul of the world.

---

## Systems Inventory

### Implemented (as of 2026-03-21)

| System | Status | Description |
|--------|--------|-------------|
| **ExcaliburJS Engine** | Stable | 4 rooms (hub, office, village, station), sprites, camera follow |
| **Agent Actors** | Stable | RPG attributes (STR/INT/WIS/CHA/DEX/CON), sprites, movement, emotes |
| **Pet Actors** | Stable | 8 pets (cats, dogs, owls, parrots, foxes), BT-driven behavior |
| **Behavior Tree Engine** | Stable | mistreevous-based, master selector with 14 subtrees, agent + pet BTs |
| **Brain System** | Stable | State machine (idle/wandering/working/on-break), `taskLocked` flag |
| **Needs System** | Stable | Energy, social, focus, morale with per-state decay rates |
| **Day Clock** | Stable | 7 phases (~25 min cycle), phase-driven need multipliers |
| **Social System** | Stable | Proximity-based conversation triggers, cluster detection |
| **Relationship System** | Stable | Affinity tracking (-100 to 100), 5 tiers (Rival → Best Friend) |
| **Memory System** | Stable | Cross-session persistence (streaks, milestones, comfort zones) |
| **Quirk System** | Stable | 15 quirks derived from attributes, behavioral modifiers |
| **Talk Engine** | Stable | Domain-driven templates, personality-flavored dialogue, 8 template categories |
| **Ritual System** | Stable | Standup, retro, celebrations |
| **Environmental Objects** | Stable | 7 objects (coffee machine, whiteboard, snack table, etc.) with attraction logic |
| **Micro-Event Scheduler** | Stable | Build breaks, deploy success, standups, eureka moments |
| **World Ambience** | Stable | Day/night lighting, weather states |
| **Particle System** | Stable | Particle pool (200), preset-based effects |
| **Sensor System** | Stable | Real project data events promote/suppress simulated events |
| **Director System** | Stable | Click-to-interact with objects, agent selection |
| **Dashboard Store** | Stable | Reactive state center, SSE integration, task tracking |
| **Room Switcher** | Stable | Cross-room agent/pet transfers |
| **Camera System** | Stable | Agent-following camera across room switches |

### Current Increment (in-progress)

| System | Status | Description |
|--------|--------|-------------|
| **Hunger & Thirst** | Planned | Energy sub-drivers, food/drink stations, pet bowls, BT integration |
| **Task Engine** | Planned | Task CRUD, lifecycle (7 states), standing orders, journey tasks |
| **Economy** | Planned | XP/Coin/Tokens, ledger, leveling (8 tiers), reward rules |
| **Progressive Trust** | Planned | Per-operation trust tiers (manual/review/auto), auto-promotion |
| **Merchant NPC** | Planned | Catalog-driven shop, capability purchases, NPC agent type |
| **Vault Operations** | Planned | 7 operation types, staging area, scoped awareness |
| **Task Routing** | Planned | WorkerManager extension, capacity, attribute scoring, auto-dequeue |
| **Process Pool** | Planned | maxConcurrent limit, queued state, timeout reaping |
| **Visual Progression** | Planned | Level glow/aura, economy particles, trust indicators |
| **Debug Panel** | Planned | Admin controls for agents, NPCs, pets |
| **Pet Utility Roles** | Planned | Scout (cat), Fetch (dog), Audit (owl), Echo (parrot), Triage (fox) |

### Future (roadmap below)

| System | Description |
|--------|-------------|
| **Offline Progress** | "Agents kept working while you were away" |
| **Emergent Narrative** | Running text story of agent activities |
| **Task Forecasting** | Predict completion time from historical performance |
| **Production Chains** | Multi-step workflows where agent outputs feed other agents |
| **Agent Interviews** | Chat with agents about completed work |
| **Session Replay** | Rewind and watch what happened |
| **Task Marketplace** | Agents bid on tasks (evolution of manager-mediated routing) |

---

## Economy Design

### Currencies

| Currency | Type | Purpose | Earned by | Spent on |
|----------|------|---------|-----------|----------|
| **XP** | Progression | Leveling (never spent) | Task completion, milestones | Accumulates toward level thresholds |
| **Coin** | Game economy | Capability + cosmetic purchases | Task rewards, bonuses | Merchant shop, delegation fees, pet food |
| **Tokens** | Real resource | LLM API budget | Director grants, Coin exchange | LLM calls (maps to real API token count) |

**Why three currencies:** XP is automatic (you always progress). Coin is choice (you decide your build). Tokens are real constraint (actual API cost). An agent can be high-level but token-poor, or low-level but well-funded. This creates interesting tension.

### Leveling

| Level | XP | Title | Key Unlock |
|-------|-----|-------|-----------|
| 1 | 0 | Novice | Basic vault read |
| 2 | 100 | Apprentice | Standing orders |
| 3 | 300 | Journeyman | Vault write (purchasable) |
| 4 | 600 | Artisan | Delegation, journeys |
| 5 | 1000 | Senior | Auto-trust eligible |
| 6 | 1500 | Expert | Cross-domain tasks |
| 7 | 2200 | Master | Mentoring (XP bonus to mentee) |
| 8 | 3000 | Grandmaster | Full autonomy eligible |

Levels gate eligibility. Coin gates purchase. Level 3 doesn't give you vault-write — it lets you BUY vault-write from the Merchant.

### Reward Scaling

| Factor | Multiplier |
|--------|-----------|
| Auto trust tier | x1.0 |
| Review trust tier | x1.2 (bonus for earning trust) |
| First completion of type | x1.5 (exploration bonus) |
| Standing order trigger | x0.3 (small, recurring) |
| Delegation management cut | x0.2 of assignee reward |

### The Merchant

An NPC shopkeeper in the hub room. Config-driven catalog with 5 categories:

- **Capability** — vault tools, delegation license, journey access
- **Resource** — token packs, task slots
- **Cosmetic** — titles, auras, workspace themes
- **Pet cosmetic** — accessories, toys
- **Room** — decorations, furniture

The Director sets prices. The Merchant is the interface, you're the central bank.

---

## Trust & Autonomy

### The Trust Ladder

Every vault operation has a trust tier per agent:

| Tier | Behavior |
|------|----------|
| **Manual** | Director must explicitly trigger each execution |
| **Review** | Agent executes, output staged for Director approval |
| **Auto** | Agent executes freely, results applied immediately |

### Auto-Promotion

After N successful completions with no rejections AND minimum level reached, trust auto-promotes:

- `vault-tag`: 20 successes, Level 2
- `vault-create`: 50 successes, Level 4
- `vault-edit`: 100 successes, Level 5

The Director is always notified on promotion and can demote at any time.

### The Trust Arc

This is the game's core narrative arc:

```
New agent arrives → Director assigns simple tasks → Agent proves itself
  → Trust promoted → More autonomy → Agent handles complex work alone
    → Director checks in less → Agent becomes trusted teammate
```

The game gets easier as you play it. Trust is the meta-progression.

---

## Agent Needs & Sustenance

### Six Needs

| Need | Decay Driver | Restore Source | Low Threshold |
|------|-------------|---------------|--------------|
| Energy | Work intensity | Rest (couch, break) | < 30 |
| Hunger | All activities, faster during lunch | SnackTable, FoodBowl | < 40 |
| Thirst | All activities, faster in morning | CoffeeMachine, WaterCooler, WaterBowl | < 30 |
| Focus | Social interruptions | Quiet work time | < 25 |
| Social | Isolation | Conversations, clusters | < 20 |
| Morale | Failures, rejection | Success, celebrations, pets | < 30 |

### Hunger/Thirst as Energy Sub-Drivers

Low hunger or thirst multiplies energy decay:
- Hunger < 40 → energy drains 1.5x faster
- Thirst < 30 → energy drains 1.5x faster
- Both low → 2.25x energy drain (stacking)

This creates urgency: an agent who skips lunch will crash by afternoon.

### Day-Phase Rhythm

The 7-phase day cycle (~25 min) drives need multipliers:

```
Morning Arrival (2 min) → Productive Morning (6 min) → Lunch (2.5 min)
  → Afternoon (6 min) → Afternoon Slump (3 min) → Wind Down (3 min)
    → Evening Departure (2 min)
```

Lunch phase: hunger decay 2x, social boost 2x. Afternoon slump: energy decays, thirst spikes. This rhythm creates predictable behavior patterns that make observation satisfying.

---

## Pets

### Functional Utility Roles

| Pet | Role | Mechanic |
|-----|------|---------|
| Cat | **Scout** | Patrols vault scope, spots untagged/orphan notes → proposes tasks |
| Dog | **Fetch** | Retrieves contextually related notes for working agents |
| Owl | **Audit** | Monitors last-modified dates, flags stale content |
| Parrot | **Echo** | Re-surfaces past micro-events and task completions as reminders |
| Fox | **Triage** | Sorts incoming inbox notes by urgency signals |

### Pet-Agent Bonding

Pets bond with the agent they spend the most time near:
- Follows agent between rooms
- +5 morale per cycle
- Preferential utility for bonded agent

### Steal/Share Mechanic

At food/drink stations, arrival order matters:
- **Pet first (steal):** Agent blocked, gets frustrated bubble, seeks alternative
- **Agent first (share):** Pet approaches, gets food/drink effect, agent gets social +3 bonus, heart particles

### Pet Progression

Pets have affection (0-100) instead of XP:
- Increases: Director interaction (pet/feed/play), agent bonding
- Decreases: Neglect (no interaction for cycles)
- Milestones at 25/50/75/100: unlock cosmetic slots, utility upgrades

---

## Visual Identity

### Art Style

Ninja Adventure sprite assets (16x16 pixel art, scaled 2-3x). Warm, cozy office aesthetic. Day/night lighting tints. Weather particles (rain, overcast, sunny).

**Asset location:** `.obsidian/plugins/flowti-ibde/assets/`
- Characters: `Actor/Characters/{name}/SeparateAnim/` (Idle, Walk, Attack, etc.)
- Food items: `Items/Food/` (Meat.png, Onigiri.png)
- Potions: `Items/Potion/` (MilkPot.png, WaterPot.png)
- Objects: `Items/Object/` (Gourd.png)
- Merchant NPC: `Actor/Characters/Master/` (authoritative shopkeeper character)

### Progression Visuals

| Level Range | Visual |
|-------------|--------|
| 1-2 | Base sprite, no adornments |
| 3-4 | Subtle domain-colored glow outline |
| 5-6 | Brighter glow, title below name, confident walk |
| 7-8 | Aura particles (slow orbit), distinct pose |

### Economy Feedback

- Task reward: floating "+50 XP / +25 Coin" text (fades 2s)
- Purchase: coin particle trail to merchant stall
- Token spend: subtle blue pulse
- Level-up: golden particle burst, nearby agents celebrate
- Trust promoted: brief fanfare, badge update

### Need Indicators

- Low hunger/thirst: pulse animation on needs bars
- Review pending: pulsing clipboard icon (amber)
- Task approved: green checkmark flash
- Standing order: loop-arrows icon near name

---

## Architecture

### CLI ↔ Plugin Boundary

```
CLI (data authority)              Plugin (presentation + execution)
├── Task store (markdown+JSON)    ├── ExcaliburJS game engine
├── Economy ledger (JSON)         ├── Behavior trees (mistreevous)
├── Trust profiles (JSON)         ├── DashboardStore (reactive)
├── Merchant catalog (JSON)       ├── Lit components (UI panels)
├── WorkerManager (routing)       ├── SSE client (receives state)
└── Agent subprocesses (LLM)      └── EventBus (vault operations)
         │                                    │
         └──── SSE bridge (HTTP+SSE) ────────┘
```

**CLI owns data.** Task definitions, economy ledger, trust rules, and routing decisions all live in CLI domain code. Pure, testable, no I/O imports.

**Plugin owns presentation.** BT execution, game rendering, UI panels, and vault file operations. Receives state updates via SSE.

**WorkerManager is CLI-side.** It manages agent subprocesses, routes tasks, tracks capacity, and deducts tokens at the point of LLM execution.

---

## Persistence

| File | Content | Written by |
|------|---------|-----------|
| `.flowti/var/economy.json` | Agent balances (XP, Coin, Tokens, level) | CLI |
| `.flowti/var/economy-log.jsonl` | Append-only transaction history | CLI |
| `.flowti/var/merchant-catalog.json` | Shop inventory and pricing | CLI |
| `.flowti/var/staging/{task-id}/` | Review-tier vault op staging area | CLI |
| `.flowti/var/world-clock.json` | Day cycle position and count | Plugin |
| `.flowti/var/world-needs.json` | Agent needs snapshots | Plugin |
| `.flowti/var/world-positions.json` | Agent/pet positions + pet hunger/thirst | Plugin |
| `.flowti/var/world-relationships.json` | Agent affinity map | Plugin |
| `.flowti/var/world-weather.json` | Current weather state | Plugin |
| `.flowti/var/data-{agent}.json` | Per-agent memory, quirks, opinions, streaks | Plugin |
| `docs/tasks/{task-id}.md` | Task definition (YAML frontmatter) | CLI |
| `docs/tasks/{task-id}.json` | Standing order payload | CLI |
| `docs/agents/merchant.md` | Merchant NPC definition | CLI |

---

## Roadmap

### Increment 1: "The Living World" (completed 2026-03-20)

7 systems that make the world feel alive without LLM calls:
- DayClock, Environmental Objects, Micro-Events, Agent Quirks
- Evolving Relationships, Ambient Visuals, Agent Memory

### Increment 2: "Sustenance & Economy" (current — 2026-03-21)

62 tasks across 5 chunks. The gameplay loop:
- Hunger/thirst needs with food/drink stations and pet steal/share
- Task engine with lifecycle, standing orders, and vault operations
- Economy (XP/Coin/Tokens), leveling, Merchant NPC
- Progressive trust system with auto-promotion
- Task routing with attribute scoring, auto-dequeue, process pool
- Visual progression, debug panel, pet utility roles

### Increment 3: "Autonomy & Narrative" (next)

Agents become self-directed. The world tells stories.

| Feature | Description | Depends On |
|---------|------------|-----------|
| **Offline Progress** | "Agents kept working while you were away." On return, summary of completed tasks, XP earned, events that happened. The killer idle-game return hook. | Economy + task queue stable |
| **Emergent Narrative Log** | Running text story: "Auditor tagged 12 notes, then took a coffee break. Analyst noticed a stale document and flagged it. They argued about tabs vs spaces at the water cooler." RimWorld-style storytelling. | Memory system + task history |
| **Task Forecasting** | Predict task completion time based on historical agent performance. "Auditor typically completes tagging tasks in 3 min." Show estimate in task assignment UI. | Economy ledger with enough data |
| **Post-hoc Agent Interviews** | Click a completed task → "Ask about this" → Agent explains what they did and why, drawing on their memory system. Lightweight LLM call with task context. | Memory system + task completion |
| **Agent Food Preferences** | Agents prefer certain stations based on quirks. Coffee-addict quirk → always picks CoffeeMachine over WaterCooler. Snacker quirk → gravitates to SnackTable. Ties into economy: buy preferred food from Merchant. | Hunger/thirst + quirk system |

### Increment 4: "Production Chains & Collaboration"

Agents work together on complex multi-step workflows.

| Feature | Description | Depends On |
|---------|------------|-----------|
| **Production Chains** | Multi-agent workflows: Agent A researches → output feeds Agent B's analysis → feeds Agent C's document creation. Inspired by the Numbercruncher's production system. | Delegation + standing orders |
| **Mentoring** | Level 7+ agents can mentor lower-level agents. Mentee gets XP bonus on task completion. Mentor gets small management cut. Visual: agents sit together at whiteboard. | Leveling system at scale |
| **Task Marketplace** | Evolution of manager-mediated routing. Agents bid on tasks based on their scoring. Director sees bids and picks. Creates agency and competition. | Task scoring + routing stable |
| **Cooking Mechanics** | Agents can prepare food at stations, requiring ingredients purchased from Merchant. Full crafting loop: buy ingredients → cook → higher-quality food → better hunger restore. | Merchant + hunger/thirst |
| **Cross-Room Transport** | Agents physically carry task artifacts between rooms. Visual: agent walks from office to village carrying a document sprite. Inspired by Numbercruncher's transport system. | Room switcher + task engine |

### Increment 5: "The Observatory"

Deep observation and insight tools.

| Feature | Description | Depends On |
|---------|------------|-----------|
| **Session Replay** | Rewind and watch what agents did during a period. Scrubber UI over the game world. See task execution in real-time playback. | Comprehensive activity logging |
| **Agent Scorecards** | Weekly/monthly report per agent: tasks completed, XP earned, trust promotions, relationship changes, quirk triggers. Generated as vault notes. | Economy + memory + relationships |
| **Life Reports** | Long-form auto-generated narrative of an agent's journey: "Auditor started as a Novice 3 weeks ago. They've completed 47 tasks, reached Level 5 Senior, and formed a best-friend bond with Analyst." | All systems mature |
| **Dashboard Widgets** | Embeddable Obsidian widgets: economy balance, task queue, agent status grid. For users who want data without opening the game world. | Economy + SSE bridge |
| **Team Analytics** | Cross-agent metrics: team velocity, task distribution, trust progression curves, economy flow diagrams. | All economy data accumulated |

---

## Design Anti-Patterns (what to avoid)

| Anti-Pattern | Why | Source |
|-------------|-----|--------|
| Requiring constant attention | Gather.town fatigue — users leave when the novelty wears off | Competitive analysis |
| Dev tool aesthetic | LangGraph/CrewAI mistake — feels like work, not play | Competitive analysis |
| Over-explaining agent reasoning | Kills narrative magic — let players project meaning | Sims GDC talk |
| Scaling to meaninglessness | Keep teams small and personal (3-8 agents) | RimWorld lesson |
| Empty rooms | Always have agents present — they ARE the content | Structural advantage |
| Punishment for absence | Never penalize offline time — reward return instead | Animal Crossing |
| Manual everything | Progressive trust should reduce Director work over time | Core game arc |

---

## Technical Constraints

- **CLI is non-interactive** — no TUI, no menus, no interactive prompts. All commands output JSON/ANSI and exit. The Plugin game world IS the interactive UI.
- **No runtime dependencies** — CLI is zero-dep Node.js
- **No LLM for ambiance** — all personality, dialogue, and behavior is template-driven and data-driven
- **LLM only for real work** — vault operations, task execution, journey steps
- **Token accounting is real** — maps to actual API spend, not game currency
- **ExcaliburJS rendering** — 2D canvas, sprite-based, runs in Obsidian's Chromium
- **Compressed time** — 25-min day cycle regardless of wall clock
- **Full persistence** — every system survives restart (world-state JSON files)

---

## References

| Document | Location |
|----------|----------|
| Task & Economy Engine Spec | `01 - Projects/Flowti CLI/docs/specs/2026-03-21-task-economy-engine-design.md` |
| Hunger/Thirst Spec | `01 - Projects/Flowti Plugin/docs/specs/2026-03-21-hunger-thirst-design.md` |
| Living World Spec | `01 - Projects/Flowti CLI/docs/specs/2026-03-20-living-world-design.md` |
| Full Increment Plan | `01 - Projects/Flowti CLI/docs/plans/2026-03-21-game-world-full-increment.md` |
| Agent World Positioning | `.claude/projects/C--Projects-flowti/memory/project_agent_world_positioning.md` |
| Numbercruncher Ideation | `00 - Connectivity/input/🟡ideation/The Economics Simulation Game/` |
| Agent Task Execution Spec | `01 - Projects/Flowti CLI/docs/specs/2026-03-19-agent-task-execution-design.md` |
| Task Queue Orchestrator Spec | `01 - Projects/Flowti CLI/docs/specs/2026-03-15-task-queue-orchestrator-design.md` |
| Stability Spec | `01 - Projects/Flowti CLI/docs/specs/2026-03-17-agent-world-stability-design.md` |
