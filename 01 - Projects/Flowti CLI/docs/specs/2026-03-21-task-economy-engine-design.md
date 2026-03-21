# Task & Economy Engine — Design Spec

> **Date:** 2026-03-21
> **Status:** Approved
> **Scope:** Task engine, economy system, merchant NPC, leveling, progressive trust, vault operations, journey integration, pet utility, visual progression, and WorkerManager routing for the Flowti Agent World

---

## Overview

A foundational system that transforms the Agent World from an animated observation layer into a productive system where agents do real vault work, earn currency, level up, and unlock capabilities. The design follows **Approach 3: Domain Core + Event Bridge** — CLI owns data and rules, Plugin owns presentation and execution runtime.

```
CLI Domain (task-engine, economy, trust)
  -> WorkerManager (CLI-side) routes tasks to agents
    -> agent subprocess executes vault operation
      -> CLI records result, awards XP/Coin, deducts Tokens
        -> WorldState updated
          -> SSE broadcasts to Plugin for visualization
            -> Plugin BT/DashboardStore reflects new state
```

**Design principles:**
- CLI is authoritative — task definitions, economy ledger, trust rules, and routing all live as CLI domain data
- WorkerManager is CLI-side infrastructure — it already manages agent subprocesses and routes world-state events; task routing extends this existing role
- Plugin is the presentation layer — BT system, DashboardStore, and game UI visualize task state received via SSE; the Plugin does NOT make routing or economy decisions
- SSE bridge already exists — no new communication layer needed
- Progressive trust — agents earn autonomy by proving themselves
- Three work channels — standing orders, direct assignments, goal-driven self-initiative
- Manager-mediated coordination — WorkerManager checks capacity, trust, and budget before accepting delegation

### Boundary Clarification

| Concern | Owner | Why |
|---------|-------|-----|
| Task definitions, lifecycle, standing orders | CLI domain | Data authority lives in CLI |
| Economy ledger, token accounting, rewards | CLI domain | Token deduction must happen at point of LLM execution (CLI side) |
| Trust tiers, promotion/demotion | CLI domain | Trust rules are config-driven |
| Routing, capacity, delegation | CLI infrastructure (WorkerManager) | Already manages agent processes |
| Standing order index | CLI domain, cached in WorkerManager | Fast lookup without crossing boundary |
| Vault operations (read, tag, create, edit) | CLI infrastructure → Plugin EventBus | CLI dispatches via SSE, Plugin's EventBus executes file I/O, result flows back |
| Visual state (sprites, particles, animations) | Plugin | Consumes SSE events, renders game world |
| BT work cycle integration | Plugin | Agent BT enters task states based on SSE-received assignments |

### Relationship to Existing Permission Model

The existing `PermissionMode` (`"ask" | "auto-allow" | "trust"`) and per-operation `PermissionEntry` system controls LLM tool-use permissions (what tools an agent can call during subprocess execution). The new trust system in this spec controls **vault operation permissions** — a different layer. They coexist:

- **Existing permissions** → "Can this agent use the `file_read` tool during LLM execution?" (subprocess-level)
- **New trust tiers** → "Can this agent tag a vault note without Director review?" (task-level)

The existing `PermissionMode` remains unchanged. The new trust system is additive — it governs task-level operations, not subprocess tool-use. Both are stored in the agent's companion JSON under separate keys (`permissions` vs `trust`).

### Design Decisions

| Decision | Choice |
|----------|--------|
| Primary pain point | No real output — agents don't produce tangible work |
| Trust boundary | Tiered trust + progressive auto-trust for stable workflows |
| Economy purpose | Combination — cosmetic + capability + resource allocation |
| Journey integration | Agents assigned journeys if they have the journey capability |
| Pet interaction | Functional utility AND personality/interaction |
| Task discovery | Standing orders + direct assignments + goal-driven autonomy |
| Task coordination | Manager-mediated (WorkerManager checks capacity/trust/budget) |
| Progression | Both visible AND mechanical |
| Architecture | Domain Core + Event Bridge (CLI owns data, Plugin owns presentation) |

---

## Section 1: Task Engine Domain

**Location:** `src/domain/tasks/`

### Task Model

A task is a unit of work with a lifecycle. Stored as markdown + companion JSON (same pattern as agents and sessions).

```
docs/tasks/{task-id}.md          -- human-readable task with YAML frontmatter
docs/tasks/{task-id}.json        -- structured payload (rules, vault paths, conditions)
```

**Task types:**
- **one-off** — single execution, then done (e.g., "tag these 5 notes")
- **standing-order** — persistent watcher that re-triggers (e.g., "watch inbox, tag new notes matching rules")
- **delegated** — created by one agent, assigned to another via WorkerManager
- **self-proposed** — agent spotted work aligned with their goals, proposed it for approval

### Task Lifecycle

```
proposed -> pending -> assigned -> in-progress -> review -> completed | failed
                                                      ^
                                                (rejected -> pending)
```

- `proposed` — agent-initiated, awaits Director approval
- `pending` — approved but unassigned
- `assigned` — WorkerManager routed it to an agent
- `in-progress` — agent is actively executing
- `review` — execution done, output awaits approval (for tasks requiring trust gate)
- `completed` — done, XP/money awarded
- `failed` — execution failed, logged for retry or reassignment

### Task Frontmatter

```yaml
---
id: task-2026-03-21-001
type: one-off | standing-order | delegated | self-proposed
title: Tag inbox notes with project labels
assignee: auditor
creator: director | agent-name
priority: normal | high | urgent
trustTier: auto | review | manual
status: pending
reward:
  xp: 50
  money: 25
tags: [inbox, tagging, organization]
createdAt: 2026-03-21T10:00:00Z
---
```

### Standing Orders

Standing orders have additional fields in the companion JSON:

```json
{
  "watch": { "folder": "00 - Inbox", "event": "file-created" },
  "rules": [
    { "match": { "tags": { "missing": ["project"] } }, "action": "tag", "value": "needs-triage" }
  ],
  "schedule": "on-event",
  "lastRun": "2026-03-21T10:30:00Z",
  "runCount": 47
}
```

### CLI Commands

```bash
flowti task:create --title="..." --assignee=auditor --type=one-off
flowti task:list --status=pending --assignee=auditor
flowti task:assign --id=task-001 --to=auditor
flowti task:approve --id=task-001          # approve proposed task
flowti task:review --id=task-001           # review completed output
flowti task:standing-orders --list
```

---

## Section 2: Economy Domain

**Location:** `src/domain/economy/`

### Currency & Ledger

Two progression currencies, one resource currency:

| Currency | Purpose | Earned by | Spent on |
|----------|---------|-----------|----------|
| **XP** | Progression, leveling | Completing tasks, milestones | Never spent — accumulates toward levels |
| **Coin** | Capability & cosmetic | Task rewards, bonuses | Tool access, LLM calls, delegation budgets, cosmetics |
| **Tokens** | LLM resource budget | Allocated by Director or earned | Consumed by LLM operations (maps to real token spend) |

**Why separate Coin from Tokens:** Coin is the game economy (fun, progression). Tokens are the real resource constraint (LLM API cost). An agent can be rich in Coin but token-poor if they've been burning through LLM calls. This gives two levers — game incentives AND real cost control.

### Ledger Storage

```
.flowti/var/economy.json          -- global ledger (all agent balances)
.flowti/var/economy-log.jsonl     -- append-only transaction history
```

**economy.json:**

```json
{
  "version": 1,
  "updatedAt": "2026-03-21T10:30:00Z",
  "accounts": {
    "auditor": {
      "xp": 1250,
      "level": 5,
      "coin": 340,
      "tokens": 5000,
      "totalEarned": { "xp": 1250, "coin": 780 },
      "totalSpent": { "coin": 440, "tokens": 32000 }
    }
  }
}
```

**Transaction log (economy-log.jsonl):**

```json
{"ts":"2026-03-21T10:30:00Z","agent":"auditor","type":"task-reward","taskId":"task-001","xp":50,"coin":25}
{"ts":"2026-03-21T10:31:00Z","agent":"auditor","type":"spend","item":"llm-call","coin":0,"tokens":1200}
{"ts":"2026-03-21T10:32:00Z","agent":"auditor","type":"delegation-fee","to":"bob","coin":10}
```

### Reward Scaling

Task rewards scale with complexity and trust tier:

| Factor | Multiplier |
|--------|-----------|
| Base reward | Defined per task |
| Trust tier auto (no review needed) | x1.0 |
| Trust tier review (Director approved) | x1.2 (bonus for earning trust) |
| First completion of task type | x1.5 (exploration bonus) |
| Standing order (per trigger) | x0.3 of base (small, recurring) |
| Delegation (assigner gets) | x0.2 of assignee's reward (management cut) |

### Spending

Agents spend Coin and Tokens on:
- **LLM calls** — costs Tokens (mapped to real API token count)
- **Delegation** — assigning a task to another agent costs a fee
- **Tool upgrades** — unlocking new vault operations costs Coin
- **Cosmetics** — room decorations, pet accessories, title badges (Coin)
- **Token refills** — Director can grant Token allowances, or agents can "buy" Tokens with Coin at an exchange rate

### CLI Commands

```bash
flowti economy:balance --agent=auditor
flowti economy:ledger --agent=auditor --last=20
flowti economy:grant --agent=auditor --coin=100 --tokens=5000
flowti economy:set-rate --token-per-coin=50
```

---

## Section 3: Merchant Agent & Trade System

### The Merchant

The Merchant is a special agent type — not AI-backed, not a pet. Think NPC shopkeeper. They exist in the game world as an actor with a fixed location (a shop/stall interactable in the hub or village).

**Agent definition** (`docs/agents/merchant.md`):

```yaml
---
name: Merchant
agentType: npc
domain: commerce
persona: "Friendly shopkeeper who knows the value of good work"
mood: cheerful
location: hub
interactable: merchant-stall
---
```

This introduces a third agent type: `"human" | "ai" | "npc"`. NPCs have no LLM, no autonomous work cycle, but they DO have personality, dialogue (template-driven like pets but richer), and a brain that responds to visitors.

### Shop Inventory

The Merchant's stock is config-driven. Stored in their companion JSON:

```json
{
  "shop": {
    "catalog": [
      {
        "id": "tool-vault-write",
        "name": "Vault Write Access",
        "category": "capability",
        "cost": { "coin": 200 },
        "requiresLevel": 3,
        "description": "Unlocks note creation and file editing",
        "oneTime": true
      },
      {
        "id": "token-pack-5k",
        "name": "Token Pack (5,000)",
        "category": "resource",
        "cost": { "coin": 100 },
        "description": "5,000 LLM tokens",
        "oneTime": false
      },
      {
        "id": "title-senior",
        "name": "Senior Title Badge",
        "category": "cosmetic",
        "cost": { "coin": 150 },
        "requiresLevel": 5,
        "description": "Display 'Senior' title in the world"
      },
      {
        "id": "pet-hat-tophat",
        "name": "Top Hat (Pet)",
        "category": "pet-cosmetic",
        "cost": { "coin": 50 },
        "description": "A dapper top hat for your companion"
      },
      {
        "id": "delegation-license",
        "name": "Delegation License",
        "category": "capability",
        "cost": { "coin": 300 },
        "requiresLevel": 4,
        "description": "Unlocks ability to assign tasks to other agents"
      }
    ],
    "buyback": 0.5,
    "restockCycle": "daily"
  }
}
```

### Shop Categories

| Category | What it contains | Economy role |
|----------|-----------------|-------------|
| **capability** | Vault tools, delegation, journey access | Mechanical progression gate |
| **resource** | Token packs, task slots | LLM budget / throttling |
| **cosmetic** | Titles, auras, workspace themes | Visible progression, fun |
| **pet-cosmetic** | Pet accessories, toys | Pet personality enhancement |
| **room** | Decorations, furniture | World-building |

### Trade Interaction

When an agent visits the merchant (walks to stall, or via CLI):
1. Agent's BT WorkCycle can include a "shop" action when they need something
2. Agent checks balance against catalog
3. Purchase transaction logged in economy ledger
4. Capability unlocks are written to the agent's companion JSON
5. Cosmetics are applied to the agent's visual state

**In the game world:** The agent physically walks to the merchant stall. A brief dialogue plays ("What can I get you today?"). Purchase animation (coin particles flying). The merchant reacts ("Good choice! That'll serve you well.").

**Via CLI:**

```bash
flowti shop:list
flowti shop:buy --agent=auditor --item=tool-vault-write
flowti shop:catalog:add --item="..." --cost=100 --category=capability
flowti shop:catalog:edit --item=tool-vault-write --cost=250
```

### Director as Economy Controller

You control the economy by:
- Setting catalog items and prices
- Granting Coin/Token allowances
- Setting the Token-per-Coin exchange rate
- Adjusting reward multipliers
- Adding/removing items from the shop

The Merchant doesn't set prices — you do. The Merchant is the interface, you're the central bank.

---

## Section 4: Leveling & Progressive Trust

### Leveling System

XP thresholds follow a curve — early levels come fast, later levels require sustained output:

| Level | XP Required | Title | Unlocks |
|-------|------------|-------|---------|
| 1 | 0 | Novice | Basic vault read, simple tasks |
| 2 | 100 | Apprentice | Standing order execution |
| 3 | 300 | Journeyman | Vault write (purchasable), self-proposed tasks |
| 4 | 600 | Artisan | Delegation license (purchasable), journey capability |
| 5 | 1000 | Senior | Auto-trust eligible, higher token budgets |
| 6 | 1500 | Expert | Cross-domain task assignment |
| 7 | 2200 | Master | Can mentor lower-level agents (XP bonus to mentee) |
| 8 | 3000 | Grandmaster | Full autonomy eligible, economy influence |

Levels gate eligibility — the agent still needs to purchase the capability from the Merchant. Level 3 doesn't give you vault write; it lets you buy vault write. This creates two progression loops: earning XP (doing work) and spending Coin (choosing your build).

### Progressive Trust System

Trust operates per-agent, per-operation. Stored in the agent's companion JSON:

```json
{
  "trust": {
    "tier": "supervised",
    "operations": {
      "vault-read": "auto",
      "vault-tag": "auto",
      "vault-create": "review",
      "vault-edit": "review",
      "delegation": "manual",
      "llm-call": "auto"
    },
    "promotionLog": [
      { "op": "vault-tag", "from": "review", "to": "auto", "at": "2026-03-21", "reason": "47 successful tags, 0 rejections" }
    ]
  }
}
```

**Three trust levels per operation:**
- **manual** — Director must explicitly trigger it each time
- **review** — agent executes, output queued for Director approval before it lands
- **auto** — agent executes freely, results applied immediately

### Trust Promotion

The path from `manual -> review -> auto`:

```
manual -> review:  Director promotes manually (flowti trust:promote)
review -> auto:    Earned automatically OR Director promotes

Auto-promotion criteria (configurable per operation):
  - Minimum N successful completions with no rejections
  - Minimum agent level
  - Both conditions must be met
```

**Default auto-promotion thresholds** (in flowti.config.json):

```json
{
  "trust": {
    "autoPromote": true,
    "thresholds": {
      "vault-tag": { "successes": 20, "minLevel": 2 },
      "vault-create": { "successes": 50, "minLevel": 4 },
      "vault-edit": { "successes": 100, "minLevel": 5 },
      "delegation": { "successes": 30, "minLevel": 5 }
    }
  }
}
```

When an operation gets auto-promoted, the Director is notified (world event + CLI notification). You can always demote back if quality drops.

### Trust Tiers (Agent-Level)

| Tier | Meaning |
|------|---------|
| **supervised** | Most operations need review. New agents start here. |
| **trusted** | Core operations are auto, only sensitive ones need review. |
| **autonomous** | Nearly everything is auto. Reserved for proven agents. |

The tier is derived from the operation trust map — if 80%+ of an agent's operations are `auto`, they're `autonomous`.

### CLI Commands

```bash
flowti trust:show --agent=auditor
flowti trust:promote --agent=auditor --op=vault-create --to=auto
flowti trust:demote --agent=auditor --op=vault-edit --to=review
flowti trust:history --agent=auditor
```

### Visual Manifestation

In the game world, trust tier shows as:
- **supervised** — no indicator (default state)
- **trusted** — subtle badge/glow on the agent
- **autonomous** — distinct aura, agents move with more confidence (animation speed/posture change)

Level-ups trigger a world event: particle burst, celebration from nearby agents, notification bubble.

---

## Section 5: Agent Detail Panel — Debug & Admin Controls

The existing agent detail panel already has tabs (Info, Talk, Tasks, Permissions, Monitor). We extend it with a **Debug tab** — visible only when Director mode is active.

### Debug Tab Sections

**Stats Override:**
```
[Level]  5  [+] [-]     [XP]  1000  [SET]
[Coin]   340 [+100] [-100] [SET]
[Tokens] 5000 [+1000] [-1000] [SET]
```

**Attributes (RPG):**
```
STR [12] [+][-]    INT [16] [+][-]    WIS [14] [+][-]
CHA [10] [+][-]    DEX [8]  [+][-]    CON [11] [+][-]
```

**Needs Override:**
```
Energy  [|||||||---] 72  [FILL] [DRAIN] [SET]
Social  [|||||-----] 50  [FILL] [DRAIN] [SET]
Focus   [||||||||--] 85  [FILL] [DRAIN] [SET]
Morale  [||||||----] 63  [FILL] [DRAIN] [SET]
```

**Trust Quick-Toggle:**
```
vault-read   [AUTO]  [REVIEW]  [MANUAL]
vault-tag    [AUTO]  [REVIEW]  [MANUAL]
vault-create [AUTO]  [REVIEW]  [MANUAL]
vault-edit   [AUTO]  [REVIEW]  [MANUAL]
delegation   [AUTO]  [REVIEW]  [MANUAL]
llm-call     [AUTO]  [REVIEW]  [MANUAL]
```

**Capabilities:**
```
[x] vault-read   [x] vault-tag   [ ] vault-write
[ ] delegation   [ ] journey     [ ] mentoring
[UNLOCK ALL]  [RESET TO LEVEL DEFAULTS]
```

**Economy Cheats:**
```
[+500 Coin]  [+10000 Tokens]  [+500 XP]  [Level Up]
[Bankrupt]   [Reset XP]       [Max Level]
```

**BT Debug:**
```
Current state: working
Active BT node: WorkCycle > PickGoal
Last tick: 340ms ago
[FORCE IDLE]  [FORCE WORK]  [FORCE SOCIAL]
[PAUSE BT]    [STEP TICK]   [RESUME]
```

### NPC Debug Controls

NPCs like the Merchant get their own debug panel:
- **Shop tuning** — edit prices, add/remove catalog items, adjust buyback rate, force restock
- **Dialogue override** — change mood, test specific dialogue lines, trigger reactions
- **Location** — move NPC to different room/position, change interactable binding
- **Economy view** — see transaction history through this NPC (who bought what, revenue)
- **Personality** — tweak persona, mood, response templates live

### Design Principles

- **Everything is instant** — no confirmation dialogs in debug mode. Changes apply immediately to the running world state.
- **Everything is logged** — debug mutations appear in the economy ledger with `type: "debug"` so you can distinguish organic progression from admin tweaks.
- **Non-destructive** — a `[RESET TO DEFAULTS]` button per section reverts to what the agent would have at their current level without debug overrides.
- **All actor types** — AI agents, NPCs, and pets all get debug tabs scaled to their complexity.

### CLI Equivalents

```bash
flowti debug:set --agent=auditor --xp=1000 --coin=500
flowti debug:trust --agent=auditor --op=vault-create --to=auto
flowti debug:needs --agent=auditor --energy=100 --morale=100
flowti debug:bt --agent=auditor --force=idle
flowti debug:unlock --agent=auditor --capability=delegation
```

---

## Section 6: Vault Operations & Agent Tools

This is how agents actually do real work. The vault operation layer bridges the task engine to Obsidian file operations.

### Operation Types

| Operation | Trust Default | What it does |
|-----------|--------------|-------------|
| `vault-read` | auto | Read note content, frontmatter, folder listings |
| `vault-search` | auto | Search vault by tags, folders, content patterns |
| `vault-tag` | review | Add/remove tags on existing notes |
| `vault-create` | review | Create new notes from templates or scratch |
| `vault-edit` | manual | Modify note content (most sensitive) |
| `vault-move` | manual | Move/rename notes between folders |
| `vault-link` | review | Add/remove wikilinks between notes |

### Operation Execution Flow

```
Agent BT decides to execute a vault operation
  -> Task engine validates: does agent have capability? (purchased from Merchant)
  -> Trust check: what tier is this operation for this agent?
     -> auto:   execute immediately via EventBus
     -> review: execute, hold output in staging, notify Director
     -> manual: queue request, wait for Director to trigger
  -> EventBus dispatches to WorkerManager
  -> WorkerManager routes to appropriate handler
  -> Handler performs file operation
  -> Result flows back: success/failure + output
  -> Task engine records completion
  -> Economy awards XP/Coin
```

### Staging Area (for `review` tier operations)

When an agent completes work that needs review, the output doesn't land in the vault immediately. It goes to a staging area:

```
.flowti/var/staging/{task-id}/
  manifest.json     -- what the agent did, what files were affected
  preview/          -- copies of created/modified files for review
```

The Director reviews via:

```bash
flowti task:review --id=task-001
flowti task:approve --id=task-001
flowti task:reject --id=task-001 --reason="tags are wrong"
```

In the game world: a notification bubble appears over the agent ("Work ready for review"). Clicking opens a review panel showing the diff/preview with approve/reject buttons.

### Agent Vault Awareness

For agents to propose work and execute standing orders, they need to understand the vault. Each agent gets a **vault context** built from:

1. **Folder map** — directory structure with note counts (auto-generated, read-only)
2. **Tag index** — all tags in use with frequencies
3. **Recent changes** — last N file events from EventBus (created, modified, deleted)
4. **Assigned scope** — which folders/tags this agent is responsible for (from agent definition)

```json
{
  "vaultScope": {
    "watch": ["00 - Inbox", "01 - Projects"],
    "tags": ["needs-triage", "project/*"],
    "exclude": ["private/*", ".obsidian"]
  }
}
```

This scoping is important — agents only see what's relevant to their role. The Auditor watches organizational folders. The Business Analyst watches project deliverables. No agent sees everything unless you explicitly grant it.

### Standing Order Execution

Standing orders wire into the EventBus:

```
EventBus emits: file-created in "00 - Inbox"
  -> WorkerManager checks: any standing orders watching this folder?
  -> Matches auditor's standing order: "tag new inbox notes"
  -> WorkerManager checks: auditor has capacity? trust tier for vault-tag?
  -> Dispatches task instance to auditor
  -> Auditor's BT picks it up on next work cycle
  -> Auditor reads note, applies rules, tags it
  -> Standing order runCount increments, small XP/Coin reward
```

---

## Section 7: Journey Integration

The Plugin's Journey Builder already lets you design multi-step workflows (canvas-based, with tools and assertions). Agents with the `journey` capability can be assigned a journey to execute as a task.

### Connection Model

- A journey is a specific task type — the agent receives a journey ID, loads the definition, and executes it step-by-step through their BT work cycle
- Journey capability is purchasable from the Merchant (requires Level 4)
- Each journey step maps to vault operations — so trust tiers still apply per-step (not per-journey)
- Journey completion awards XP/Coin based on step count and complexity

### Journey Task Frontmatter

```yaml
---
id: task-2026-03-21-010
type: one-off
title: Execute onboarding journey for new project
assignee: orchestrator
journeyId: journey-onboard-project
trustTier: review
reward:
  xp: 200
  coin: 100
---
```

### Execution Flow

1. WorkerManager assigns journey-task to capable agent
2. Agent's BT enters `journey-execute` state
3. Agent loads journey definition, iterates steps
4. Each step's vault operation goes through trust check (per-operation, not per-journey)
5. If any step requires `review` — journey pauses, Director gets notified
6. On approval, agent resumes from the paused step
7. On completion, full journey reward awarded + per-step XP bonuses

### Visual Manifestation

In the game world, the agent visually moves between relevant objects as they execute journey steps (e.g., walks to notice board to read project info, walks to whiteboard to plan, walks to workstation to create notes). A journey progress indicator shows above their head.

---

## Section 8: Pet Interaction & Utility

Pets are both functional companions and personality-rich world enhancers. They have BTs and needs but no LLM or talk engine.

### Functional Roles by Pet Type

| Pet | Utility Role | How it works |
|-----|-------------|-------------|
| Cat | **Scout** — spots untagged/orphan notes | Periodically "patrols" vault scope, flags anomalies as proposed tasks for nearby agent |
| Dog | **Fetch** — retrieves related notes | When an agent is working, dog "fetches" contextually related notes into their vault context |
| Owl | **Audit** — watches for stale content | Monitors last-modified dates, flags notes untouched for N days |
| Parrot | **Echo** — repeats important events | Re-surfaces past micro-events and task completions as reminders |
| Fox | **Triage** — prioritizes inbox | Sorts incoming notes by urgency signals (keywords, sender patterns) |

### Director Interaction Model

- **Click pet** → radial menu: Pet, Feed, Play, Command, Stats
- **Pet** → mood boost, affection animation, nearby agents react ("Aww")
- **Feed** → restores pet energy, costs a small Coin amount (from Director's reserve or agent's wallet)
- **Play** → mini-interaction (fetch animation, chase sequence), boosts pet morale + nearby agent morale
- **Command** → direct the pet to patrol a specific folder or follow a specific agent
- **Stats** → pet detail panel (needs, affection, utility stats, cosmetics equipped)

### Pet-Agent Bonding

Pets bond with the agent they spend the most time near. A bonded pet:
- Follows that agent between rooms
- Boosts the agent's morale passively (+5 per cycle)
- Performs utility role preferentially for that agent
- Visual indicator: pet sits near agent's workstation

### Pet Progression

Pets don't have XP/Coin but they do have:
- **Affection** (0-100) — increases with interaction, decays with neglect
- **Utility score** — tracks how many useful findings the pet has surfaced
- At affection milestones (25, 50, 75, 100): unlock cosmetic slots, new animations, utility upgrades

---

## Section 9: Visual Manifestation of Progression

Progression is tangible in the game world. Leveling, trust, economy, and capabilities all manifest visually.

### Agent Visual Evolution by Level

| Level Range | Visual Change |
|-------------|--------------|
| 1-2 (Novice/Apprentice) | Base sprite, no adornments |
| 3-4 (Journeyman/Artisan) | Subtle glow outline matching domain color, small badge icon |
| 5-6 (Senior/Expert) | Brighter glow, title text renders below name, walk animation gains confidence (slightly faster, straighter path) |
| 7-8 (Master/Grandmaster) | Aura particles (slow orbit), distinct sprite pose, other agents occasionally glance at them |

### Level-Up Event

When an agent levels up:
1. Work pauses momentarily
2. Golden particle burst (reuse `firework` preset from Living World spec)
3. Level-up bubble: "Level 5 — Senior!"
4. Nearby agents react: celebration bubbles, applause emotes
5. If pet is bonded: pet does a happy animation
6. Notification to Director (CLI + game world)

### Economy Visual Cues

- **Purchase from Merchant:** Coin particle trail from agent to merchant stall, item sparkle on acquisition
- **Task reward:** Small floating "+50 XP / +25 Coin" text above agent on task completion (fades over 2s)
- **Token spend:** Subtle blue pulse when agent uses LLM tokens (indicates "thinking")
- **Low balance warning:** Agent thought bubble "Running low on tokens..." when below 10% of their peak

### Trust Visual Indicators

- **Review pending:** Pulsing clipboard icon above agent, amber glow
- **Task approved:** Green checkmark flash, agent does a small satisfied nod
- **Task rejected:** Red X flash, agent slumps briefly, then returns to work
- **Trust promoted:** Brief fanfare (smaller than level-up), trust badge updates

### Capability Unlock Visuals

When an agent buys a new capability from the Merchant:
- Tool icon briefly appears above them (e.g., quill for vault-write, chain-link for delegation)
- Agent examines the "item" for a beat (inspection animation)
- Capability badge appears in their detail panel

### Standing Order Visuals

Agents executing standing orders show a subtle repeating icon (loop arrows) near their name — distinguishing routine work from one-off tasks.

---

## Section 10: WorkerManager Capacity & Routing

The CLI's `WorkerManager` (`src/infrastructure/worker-manager.ts`) is the orchestration backbone — it already manages agent subprocess lifecycle and routes world-state events. Task routing extends this existing role. All routing, capacity, and budget decisions happen CLI-side.

### Capacity Model

Each agent has a task capacity based on level:

| Level | Max Concurrent Tasks | Max Standing Orders |
|-------|---------------------|-------------------|
| 1-2 | 1 | 1 |
| 3-4 | 2 | 2 |
| 5-6 | 3 | 3 |
| 7-8 | 4 | 4 |

An agent at capacity rejects new assignments — the WorkerManager routes to the next eligible agent or queues the task.

### Routing Priority

When multiple agents can handle a task:

1. **Scope match** — agent whose `vaultScope` covers the task's target folder/tags
2. **Domain match** — agent whose domain aligns with the task type (e.g., auditor for tagging, analyst for reports)
3. **Trust match** — prefer agents with `auto` trust for the required operation (faster throughput, no review bottleneck)
4. **Capacity headroom** — prefer agents with fewer active tasks
5. **Affinity** — if an agent has done this task type before (standing order history), prefer them (consistency)

### Delegation Flow

```
Agent A creates delegated task
  -> WorkerManager checks: does A have delegation capability? (purchased)
  -> WorkerManager deducts delegation fee from A's Coin
  -> WorkerManager evaluates eligible agents using routing priority
  -> Selected agent B gets the assignment
  -> B executes, result flows back through normal task lifecycle
  -> B gets full task reward
  -> A gets management cut (x0.2 of B's XP/Coin reward)
```

### Failure Handling

| Scenario | WorkerManager Response |
|----------|----------------------|
| Agent fails task | Log failure, increment agent's failure count, reassign to next eligible agent |
| 3 consecutive failures (same agent) | Suspend agent from that task type for 1 cycle, notify Director |
| No eligible agent | Queue task as `pending`, notify Director "no agent available" |
| Agent over budget (no Tokens) | Pause token-consuming tasks, agent works on non-LLM tasks only |
| Standing order fails | Retry once after cooldown, then pause standing order and notify Director |

### Health Monitoring

WorkerManager runs a periodic health check (every 60s):
- Detect stale `in-progress` tasks (no progress for > 5 min)
- Detect agents stuck in `journey-execute` state
- Auto-recover by reassigning or notifying Director

### CLI Commands

```bash
flowti worker:status                    # show all agents, capacity, active tasks
flowti worker:queue                     # show pending/queued tasks
flowti worker:reassign --id=task-001    # manually reassign a task
flowti worker:pause --agent=auditor     # pause all task assignments to an agent
flowti worker:resume --agent=auditor    # resume assignments
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/domain/tasks/task-store.ts` | Task CRUD — createStore-based, markdown+JSON persistence |
| `src/domain/tasks/task-lifecycle.ts` | State machine for task lifecycle transitions |
| `src/domain/tasks/standing-orders.ts` | Standing order matching, scheduling, run tracking |
| `src/domain/economy/economy-ledger.ts` | Account balances, transaction recording, reward calculation |
| `src/domain/economy/economy-rules.ts` | Reward scaling, spending rules, exchange rates |
| `src/domain/economy/leveling.ts` | XP thresholds, level-up logic, capability eligibility |
| `src/domain/trust/trust-manager.ts` | Per-operation trust tiers, promotion/demotion logic |
| `src/domain/trust/trust-rules.ts` | Auto-promotion thresholds, tier derivation |
| `src/domain/merchant/merchant-catalog.ts` | Shop inventory, purchase validation, restock |
| `src/controller/task.controller.ts` | CLI commands: task:create, task:list, task:assign, etc. |
| `src/controller/economy.controller.ts` | CLI commands: economy:balance, economy:ledger, etc. |
| `src/controller/shop.controller.ts` | CLI commands: shop:list, shop:buy, shop:catalog:* |
| `src/controller/trust.controller.ts` | CLI commands: trust:show, trust:promote, trust:demote |
| `src/controller/worker.controller.ts` | CLI commands: worker:status, worker:queue, etc. |
| `src/controller/debug.controller.ts` | CLI commands: debug:set, debug:trust, debug:needs, etc. |

### Modified Files

**CLI-side:**

| File | Changes |
|------|---------|
| `src/domain/agents/agent-types.ts` | Extend `AgentType` union: `"human" \| "ai" \| "npc"`. Add `TaskStatus` extended type with new states. Reconcile existing `experience?` field — superseded by `xp` in economy ledger (deprecate, read-only compat) |
| `src/domain/agents/agent-store.ts` | Update frontmatter parser to accept `"npc"` as valid `agentType` (currently binary `"ai" \| "human"`). Add trust/capability companion JSON fields |
| `src/domain/agents/world-state-types.ts` | Add economy snapshot fields (level, coin, tokens) to `WorldStateAgent` for SSE broadcast |
| `src/infrastructure/worker-manager.ts` | Add task routing, capacity tracking, standing order index, health monitoring |
| `configs/flowti.config.json` | Add `trust.thresholds`, `economy.tokenPerCoin` sections |
| `configs/sitemap.json` | Add task, economy, shop, trust, worker, debug pages |

**Plugin-side:**

| File | Changes |
|------|---------|
| `src/game/config/agent-markdown-roster.ts` | Handle `agentType: "npc"` — pass through as valid value (currently falls through as raw string) |
| `src/game/data/types.ts` | Extend `TaskStatus` to include `"proposed" \| "assigned" \| "review"` states. Add `AgentType` with `"npc"` |
| `src/game/systems/bt-system.ts` | Type-gate NPCs: skip BT creation for `agentType: "npc"` (NPCs get a stub reactive brain, not a full BT) |
| `src/game/ui/panel-info.ts` | Render "NPC" label for `agentType: "npc"` (currently shows "Human" for non-AI) |
| `src/game/ui/panel-tasks.ts` | Handle NPC agent type in task display (NPCs don't execute tasks but do have transaction history) |
| `src/game/store/dashboard-store.ts` | Add economy state (level, coin, tokens) to `DashboardAgent`. Extend `TabName` with `"debug"` tab. Note: existing 5th tab is `"monitor"`, not "History" |

### Token Accounting

Token deduction happens at the point of actual LLM execution — CLI-side in `WorkerManager`. The flow:

1. Agent subprocess begins LLM call → WorkerManager checks Token balance in economy ledger
2. If insufficient Tokens → reject, agent falls back to non-LLM task
3. LLM call completes → WorkerManager reads actual token usage from stream response
4. Economy ledger debited with actual spend (not estimated)
5. Transaction logged in `economy-log.jsonl` with `type: "llm-spend"`

This ensures accounting accuracy — the CLI measures real token spend because it owns the LLM subprocess.

### Merchant Catalog Storage

The Merchant's shop catalog is stored separately from the agent companion JSON to avoid ownership conflicts with `agent-store.ts`:

```
.flowti/var/merchant-catalog.json    -- shop inventory, managed by merchant-catalog.ts
docs/agents/merchant.md              -- NPC personality/definition only (no shop data)
```

The `merchant-catalog.ts` domain module owns the catalog CRUD. The agent store never sees or validates shop fields. CLI commands (`flowti shop:catalog:*`) write to the catalog file directly.

### Standing Order Index

Standing order definitions live in `docs/tasks/` (CLI domain). WorkerManager maintains an in-memory index of active standing orders, rebuilt on startup from the task store. When a vault event occurs:

1. CLI receives file-change notification (via Plugin EventBus → SSE)
2. WorkerManager checks its standing order index (in-memory, no cross-boundary call)
3. Matching orders are dispatched as task instances through normal routing

The index is refreshed when tasks are created/modified via CLI commands. CLI remains authoritative — the index is a read cache, not a source of truth.

### Journey Checkpoint Persistence

The existing `JourneyExecutorService` has no pause/resume capability. For Section 7's review-gated journey pauses, the journey executor needs a checkpoint mechanism:

```json
{
  "journeyId": "journey-onboard-project",
  "taskId": "task-2026-03-21-010",
  "currentStep": 3,
  "totalSteps": 8,
  "status": "paused-for-review",
  "stepResults": [
    { "step": 1, "status": "completed", "at": "2026-03-21T10:30:00Z" },
    { "step": 2, "status": "completed", "at": "2026-03-21T10:31:00Z" },
    { "step": 3, "status": "awaiting-review", "at": "2026-03-21T10:32:00Z" }
  ]
}
```

Stored in `.flowti/var/staging/{task-id}/journey-checkpoint.json`. On approval, the executor resumes from `currentStep`. This is a Phase D prerequisite — the checkpoint format must be designed in Phase B alongside the staging area.

### Persistence Files

| File | Content |
|------|---------|
| `.flowti/var/economy.json` | Global ledger — all agent balances, levels |
| `.flowti/var/economy-log.jsonl` | Append-only transaction history |
| `.flowti/var/merchant-catalog.json` | Shop inventory and pricing |
| `.flowti/var/staging/{task-id}/` | Staging area for review-tier vault operations |
| `.flowti/var/staging/{task-id}/journey-checkpoint.json` | Journey execution checkpoint (for review-gated pauses) |
| `docs/tasks/{task-id}.md` | Per-task markdown with YAML frontmatter |
| `docs/tasks/{task-id}.json` | Per-task structured payload |
| `docs/agents/merchant.md` | Merchant NPC definition (personality only, no shop data) |

---

## Implementation Phases (recommended order)

To reduce blast radius, implement in 4 phases:

1. **Phase A — Task Engine + Economy Core** (task store, lifecycle, economy ledger, leveling, CLI commands)
2. **Phase B — Trust + Vault Operations + Staging** (trust manager, vault operations, staging area, standing orders, journey checkpoint format)
3. **Phase C — Merchant + Trade + NPC Type** (NPC agent type across CLI+Plugin, catalog, shop interaction, delegation flow)
4. **Phase D — Integration + Visuals** (WorkerManager routing, journey integration, pet utility, visual manifestation, debug panel)

Each phase is independently shippable and testable.

### Phase Prerequisites

- Phase B depends on Phase A (trust checks reference economy levels)
- Phase C depends on Phase A (purchases debit Coin from economy ledger)
- Phase D depends on all prior phases
- The `firework` particle preset referenced in Section 9 is defined in the Living World spec — it must be implemented (or a simpler substitute used) before Phase D visual work begins
