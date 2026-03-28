# Project Meridian — Arc42 Architecture Document

> Derived from: Game Design Document (Project Meridian.md), Player Depth Design Spec, Phase 0 Implementation Plans
> Version: 1.0.0 | Date: 2026-03-28

---

## 1 · Introduction and Goals

### 1.1 Requirements Overview

Project Meridian is an **emergent agent-simulation sandbox RPG** implemented as an **Obsidian plugin**. The player ("The Director") orchestrates a living world through indirect control — placing quests, objects, and zones while autonomous agents make their own decisions using behavior trees, mood, memory, and social dynamics.

**Core requirements:**
- Autonomous agents with needs, mood, memory, goals, skills, and behavior trees
- Production economy with supply chains, jobs, trade, and property
- Director-as-player with indirect control (quests, zones, objects, dialogue)
- Obsidian vault as the persistence layer (markdown, Canvas, JSON)
- Emergence from system interaction, not hardcoded behavior
- Resilient runtime (Result types, Circuit Breakers, error boundaries)
- Multilang support (vue-i18n + locale files)

### 1.2 Quality Goals

| Priority | Quality Goal | Scenario |
|----------|-------------|----------|
| 1 | **Emergence** | Complex behavior arises from simple system interactions — no scripted outcomes |
| 2 | **Resilience** | A single system failure never crashes the simulation or corrupts the vault |
| 3 | **Data-driven** | All game behavior is configurable via vault files and game-config.json — no code changes for tuning |
| 4 | **Testability** | Every system is independently testable with mock dependencies |
| 5 | **Performance** | 300 entities processed within a 500ms tick budget |

### 1.3 Stakeholders

| Stakeholder | Expectations |
|-------------|-------------|
| The Director (player) | Intuitive indirect control, observable emergence, story curation tools, pause-and-plan |
| Game Designer | Tunable balance via config, emergence validation, pacing control |
| Developer | Clear architecture, TDD, ESLint enforcement, focused files |
| Modder | Data-driven content (vault files), future plugin API |
| QA | Deterministic tests for simple scenarios, statistical tests for complex emergence |

---

## 2 · Constraints

### 2.1 Technical Constraints

| Constraint | Rationale |
|-----------|-----------|
| **Obsidian Plugin** | Host environment. Must use Obsidian's Plugin API, file system, and view lifecycle. |
| **ExcaliburJS v0.29+** | Game engine. Provides ECS, Actor, collision, rendering, camera, input. Already validated via spike. |
| **TypeScript strict mode** | Type safety, Zod integration, no `any` types. |
| **Single-process Electron** | ExcaliburJS render loop (60 FPS) and tick simulation (2 Hz) share one process. Fixed timestep accumulator pattern. |
| **Zero runtime npm dependencies** | All deps bundled by Vite. Obsidian and Electron are external. |
| **Vault as database** | Markdown + Canvas + JSON files are the canonical data store. No SQLite, no IndexedDB. |
| **No bare try/catch in domain/systems** | Result type for all fallible ops. Infrastructure boundary code is exempted. |

### 2.2 Organizational Constraints

| Constraint | Rationale |
|-----------|-----------|
| **TDD methodology** | Red-green-refactor. No implementation without a test. |
| **ESLint architecture enforcement** | Layer direction enforced at lint time. Violations fail CI. |
| **80% coverage target** | Per system, not globally. |
| **Frequent commits** | One commit per task step. Small, reviewable changes. |

### 2.3 Conventions

| Convention | Rule |
|-----------|------|
| File naming | kebab-case (`game-engine.ts`) |
| Imports | `.js` extension (ESM) |
| Indentation | Tabs |
| ID prefixes | `agent-`, `item-`, `trait-`, `recipe-`, `job-`, `quest-`, `plot-`, `loc-`, `event-`, `season-`, `scenario-`, `species-` |
| Schema naming | `{Entity}Schema` (PascalCase) |
| System naming | `{Name}System` (PascalCase) |

---

## 3 · Context and Scope

### 3.1 Business Context

```
┌──────────────────────────────────────────────────────────┐
│                    Obsidian Desktop                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Project Meridian Plugin                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ExcaliburJS│  │Vue/Pinia │  │  Simulation      │ │  │
│  │  │(Rendering)│  │(Mgmt UI) │  │  (ECS + Systems) │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │  │
│  │       │              │                  │           │  │
│  │       └──────────────┴──────────────────┘           │  │
│  │                      │                              │  │
│  │              ┌───────┴────────┐                     │  │
│  │              │   VaultSync    │                     │  │
│  │              └───────┬────────┘                     │  │
│  └──────────────────────┼────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │              Obsidian Vault (filesystem)            │  │
│  │  agents/ items/ quests/ config/ graphs/ chronicles/ │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────┐                                  │
│  │  LLM Provider      │◄── Optional, Circuit Breaker    │
│  │  (Cursor/Claude/   │    protected                     │
│  │   Ollama)          │                                  │
│  └────────────────────┘                                  │
└──────────────────────────────────────────────────────────┘
```

| External System | Interface | Notes |
|----------------|-----------|-------|
| Obsidian Vault | File system (read/write/watch via VaultAdapter) | Canonical persistence layer |
| LLM Provider | HTTP API (via LLMProvider interface) | Optional. Circuit Breaker protected. Fallback to templates. |
| Obsidian Platform | Plugin API, ItemView, workspace | Host environment for the plugin |

### 3.2 Technical Context

```
┌─────────────────────────────────────────┐
│            Plugin Process               │
│                                         │
│  ExcaliburJS Engine ◄─── Game Loop      │
│       │                    │            │
│       ▼                    ▼            │
│  Actor/Scene       Tick Accumulator     │
│  Rendering         (500ms threshold)    │
│       │                    │            │
│       │             ┌──────┴──────┐     │
│       │             │ System      │     │
│       │             │ Pipeline    │     │
│       │             │ (25 systems)│     │
│       │             └──────┬──────┘     │
│       │                    │            │
│       │              EventBus           │
│       │                    │            │
│       ▼                    ▼            │
│  Canvas/WebGL      Pinia Stores         │
│  (60 FPS)          (Vue reactivity)     │
│                          │              │
│                    Vue Sidebar           │
│                    (Management UI)       │
└─────────────────────────────────────────┘
```

---

## 4 · Solution Strategy

### 4.1 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **ExcaliburJS ECS as foundation** | Built-in Entity/Component/System/World/Query. Actors provide position, collision, graphics, pointer events. No custom ECS needed. |
| **Fixed timestep accumulator** | ExcaliburJS renders at 60 FPS. Simulation ticks at 2 Hz (500ms). Accumulator pattern gives smooth rendering with deterministic simulation. |
| **Vault-as-database** | Every entity is a markdown file. Zod validates at boundary. Director can inspect/edit files directly in Obsidian. |
| **EventBus for inter-system communication** | Systems never import each other. All communication via typed events with priority, history, and batching. |
| **Result type for error handling** | No bare try/catch in domain/system code. Explicit success/failure paths. Composable via map/flatMap. |
| **Modifier pipeline** | Traits → Seasons → World Events → Time-of-Day. Rate modifiers multiplicative, flat modifiers additive. Clamped. |
| **BT + Blackboard** | Behavior Trees read a Blackboard populated from ECS components. BT writes selectedAction → systems execute. Independently testable. |
| **Dual rendering: ExcaliburJS + Vue** | ExcaliburJS renders the world map. Vue renders the management sidebar. Pinia stores bridge ECS → Vue via UIBridgeSystem. |
| **Circuit Breaker for LLM** | LLM failures don't cascade. Template fallback activates seamlessly. Priority queue: Director > Chronicler > agent-to-agent. |
| **Seeded RNG for test determinism** | All random decisions consume from injectable GameRNG. Fixed seeds in tests, Math.random in production. |

### 4.2 Technology Mapping

| Layer | Technology | Role |
|-------|-----------|------|
| Platform | Obsidian Plugin API | Host environment, vault persistence, file system |
| Runtime/ECS | ExcaliburJS v0.29+ | ECS, Actor, Actions API, collision (SparseHashGrid), camera, EventEmitter, Timer, scenes, debug, input, graphics (WebGL + Canvas fallback) |
| Pathfinding | @excaliburjs/plugin-pathfinding | A* and Dijkstra for region graph navigation |
| BT Engine | mistreevous | Behavior tree evaluation (agent + animal decision-making) |
| UI Framework | Vue 3 (Composition API) | Management sidebar (collapsible sections) |
| State Management | Pinia | Reactive stores bridging ECS → Vue |
| Validation | Zod | Schema definition, runtime validation, TypeScript type inference |
| Persistence | Obsidian Vault (markdown + Canvas + JSON) | Data-driven world definition and state |
| LLM | Unified LLMProvider interface | Optional dialogue enrichment (Cursor API first) |
| i18n | vue-i18n | Reactive locale switching for Vue UI |
| Testing | Vitest + Vue Test Utils + MSW + memfs | Unit, integration, component, emergence |
| Component Dev | Storybook | Isolated Vue component development |
| Linting | ESLint (flat config) | Architecture enforcement, layer boundaries |
| Build | Vite | Fast builds, HMR, CJS output for Obsidian |

---

## 5 · Building Block View

### 5.1 Level 1 — System Decomposition

```
┌─────────────────────────────────────────────────────────────┐
│                    Project Meridian Plugin                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Domain       │  │Infrastructure│  │  UI               │  │
│  │              │  │              │  │                   │  │
│  │  core/       │  │  engine/     │  │  Vue sidebar      │  │
│  │  schemas/    │  │  vault/      │  │  Pinia stores     │  │
│  │  systems/    │  │  config/     │  │  Storybook        │  │
│  │              │  │  event-bus   │  │                   │  │
│  │              │  │  logger/     │  │                   │  │
│  │              │  │  llm/        │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                              │
│  Layer direction: Infrastructure → Domain → UI               │
│  Domain NEVER imports Infrastructure or UI                   │
│  UI NEVER imports Domain internals (uses Pinia stores)       │
│  Systems NEVER import other systems (use EventBus)           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Level 2 — Domain Layer

```
domain/
├── core/
│   ├── result.ts           — Result<T, E> with map/flatMap
│   ├── events.ts           — GameEvent, EventHandler, EventBus interface
│   ├── logger.ts           — Logger interface
│   └── vault-adapter.ts    — VaultAdapter interface (read/write/list)
│
├── schemas/
│   ├── common.ts           — Position, MemoryEntry, Goal, Skill, Inventory, Equipment, LLM
│   ├── agent-schema.ts     — AgentSchema (27 fields, Zod-validated)
│   ├── trait-schema.ts     — TraitSchema (effects, conflicts, assignable_by)
│   ├── game-config-schema.ts — GameConfigSchema (complete game tuning)
│   ├── item-schema.ts      — [Phase 4] ItemSchema
│   ├── recipe-schema.ts    — [Phase 5] RecipeSchema
│   ├── job-schema.ts       — [Phase 5] JobSchema
│   ├── quest-schema.ts     — [Phase 6] QuestSchema
│   ├── building-schema.ts  — [Phase 7] BuildingSchema
│   ├── location-schema.ts  — [Phase 2] LocationSchema
│   ├── species-schema.ts   — [Phase 10] SpeciesSchema
│   ├── season-schema.ts    — [Phase 12] SeasonSchema
│   ├── scenario-schema.ts  — [Phase 6] ScenarioSchema
│   ├── world-event-schema.ts — [Phase 12] WorldEventSchema
│   └── tool-schema.ts      — [Phase 6] ToolSchema
│
└── systems/
    ├── trait-resolver.ts    — Modifier map building + conflict detection
    ├── needs-decay.ts       — [Phase 1] Hunger/energy/social decay
    ├── mood.ts              — [Phase 1] Mood calculation + external modifiers
    ├── memory.ts            — [Phase 1] Decay, pruning, min lifespan
    ├── ... (25 total systems, built across phases 0-13)
```

### 5.3 Level 2 — Infrastructure Layer

```
infrastructure/
├── engine/
│   ├── game-engine.ts      — ExcaliburJS Engine factory
│   └── game-view.ts        — Obsidian ItemView wrapping ExcaliburJS
│
├── vault/
│   ├── frontmatter-parser.ts    — YAML frontmatter extraction (Result-based)
│   ├── vault-loader.ts          — Single-file Zod-validated loading + quarantine
│   ├── vault-directory-loader.ts — Directory scan → validated entity collection
│   ├── memfs-vault-adapter.ts   — In-memory VaultAdapter for testing
│   ├── obsidian-vault-adapter.ts — [Phase 9] Obsidian file system adapter
│   └── quarantine.ts            — Invalid file tracking
│
├── config/
│   └── game-config-loader.ts    — JSON → Zod validate → GameConfig
│
├── event-bus.ts    — EventBus implementation (priority, history, filter, batching)
│
├── logger/
│   ├── console-logger.ts   — Dev logging target
│   └── vault-logger.ts     — [Phase 9] Vault file logging target
│
└── llm/
    ├── llm-provider.ts     — [Phase 11] Unified LLMProvider interface
    ├── cursor-provider.ts  — [Phase 11] Cursor API implementation
    └── circuit-breaker.ts  — [Phase 11] Circuit Breaker wrapper
```

### 5.4 Level 2 — UI Layer

```
ui/
├── App.vue                  — [Phase 8] Root component
├── AppToolbar.vue           — [Phase 8] Toolbar with speed/season/treasury/notifications
├── MapContainer.vue         — [Phase 2] ExcaliburJS canvas host
├── ManagementSidebar.vue    — [Phase 8] Collapsible sections (Obsidian-native pattern)
│   ├── AgentListPanel.vue   — [Phase 8] Agent list → detail
│   ├── QuestPanel.vue       — [Phase 8] Quest management
│   ├── JobPanel.vue         — [Phase 8] Job/facility overview
│   ├── EconomyPanel.vue     — [Phase 8] Prices, supply/demand, treasury
│   ├── ChroniclerPanel.vue  — [Phase 8] Observations, digests, reports
│   ├── EventPanel.vue       — [Phase 8] EventBus log, world events
│   ├── DialoguePanel.vue    — [Phase 8] Agent conversation
│   ├── ScenarioPanel.vue    — [Phase 8] Scenario goals/progress
│   ├── StoryPanel.vue       — [Phase 8] Bookmarks, eras, timeline
│   ├── ConfigPanel.vue      — [Phase 8] Global settings
│   └── DebugPanel.vue       — [Phase 13] Modifier/Blackboard/Performance inspector
└── stores/
    ├── useAgentStore.ts     — [Phase 8] Agent state from UIBridge
    ├── useQuestStore.ts     — [Phase 8] Quest lifecycle
    ├── useEconomyStore.ts   — [Phase 8] Economy data
    ├── useChroniclerStore.ts — [Phase 8] Chronicler output
    ├── useWorldStore.ts     — [Phase 8] Tick, time, speed
    ├── useTreasuryStore.ts  — [Phase 8] Director treasury
    ├── useSeasonStore.ts    — [Phase 12] Season/day-night
    └── ... (14 total stores)
```

---

## 6 · Runtime View

### 6.1 Tick Execution Sequence

```
ExcaliburJS Engine.update(delta)
│
├─ Accumulate elapsed time
├─ If accumulator >= tick_interval_ms:
│   │
│   ├─ TraitResolverSystem (0.5)    — Build modifier maps
│   ├─ DayNightSystem (0.7)         — Set timeOfDay flag
│   ├─ NeedsDecaySystem (1)         — Decay hunger/energy/social
│   ├─ MoodSystem (2)               — Recalculate mood + external modifiers
│   ├─ PerceptionSystem (3)         — Spatial queries via SparseHashGrid
│   ├─ MemorySystem (4)             — Decay significance, prune
│   ├─ BehaviorTreeSystem (5)       — Evaluate all agent BTs via Blackboard
│   ├─ MovementSystem (5.5)         — Process ActionIntents, region transitions
│   ├─ JobSystem (6)                — Production, wages, facility fund
│   ├─ QuestEvaluationSystem (7)    — Objective tracking
│   ├─ ObjectInteractionSystem (8)  — World object use
│   ├─ ToolExecutionSystem (9)      — File ops via Command pattern
│   ├─ ConstructionSystem (10)      — Building progress
│   ├─ TradeSystem (11)             — Agent-to-agent exchange (Saga)
│   ├─ DialogueSystem (12)          — Social interactions + gossip
│   ├─ ProgressionSystem (13)       — XP, skill-by-use
│   ├─ RelationshipSystem (14)      — Canvas graph updates (in-memory)
│   ├─ MortalityCheckSystem (14.5)  — Collapse, death, legacy
│   ├─ ItemDurabilitySystem (15)    — Wear, breakage, spoilage
│   ├─ EconomySystem (16)           — Price recalculation (every N ticks)
│   ├─ WorldEventSystem (17)        — Random events (every M ticks)
│   ├─ SeasonSystem (17.5)          — Season advancement
│   ├─ NotificationSystem (18)      — Director alert filtering
│   ├─ ChroniclerSystem (18.5)      — Observation, narration, welfare, candidates
│   ├─ ScenarioSystem (18.7)        — Goal tracking, scoring
│   ├─ AbandonmentSystem (18.8)     — Facility abandonment detection
│   ├─ VaultSyncSystem (19)         — Persist dirty entities (debounced)
│   └─ UIBridgeSystem (20)          — Push diffs to Pinia stores
│
├─ Reset accumulator
│
└─ Render frame (ExcaliburJS Scene.draw)
    ├─ Actor sprites (agents, animals, objects)
    ├─ Region boundaries
    ├─ Zone overlays
    ├─ Debug overlays (if enabled)
    └─ Camera follow/zoom
```

### 6.2 Director Action Flow (Place Object)

```
Director clicks map position
│
├─ UI: MapContainer receives pointer event
├─ UI: Object catalog popup → Director selects type
├─ UI: Dispatch DirectorAction { type: 'PlaceObject', objectType, position }
│
├─ [If paused: queue action for next tick]
│
├─ Tick: DirectorActionHandler processes queue
│   ├─ Validate treasury balance >= placement_cost
│   ├─ Create ExcaliburJS Actor (WorldObject) at position
│   ├─ Deduct treasury gold
│   ├─ Emit ObjectPlaced event
│   └─ Mark entity dirty for VaultSync
│
├─ VaultSyncSystem (tick 19): Write new markdown file to vault
├─ UIBridgeSystem (tick 20): Push update to Pinia stores
├─ NotificationSystem (tick 18): "Food cart placed" notification
└─ ChroniclerSystem (tick 18.5): Log observation
```

### 6.3 Supply Chain Flow (Wheat → Bread)

```
Farm (JobSystem tick 6)
├─ Farmer on shift → recipe executes → wheat produced
├─ Wheat added to farm inventory
├─ ProductionCompleted event emitted

Mill detects low flour input (facility auto-quest)
├─ Owner BT posts "Deliver 10 wheat to mill" quest to billboard
├─ QuestCreated event

Available agent scans billboard (BT node 5)
├─ Evaluates quest reward vs cost
├─ Accepts → travels to farm → buys wheat → carries to mill → delivers
├─ QuestCompleted event

Mill (JobSystem tick 6)
├─ Miller on shift → wheat available → recipe executes → flour produced

Bakery (same pattern)
├─ Flour → bread via recipe

Shop (JobSystem tick 6)
├─ Shopkeeper sells bread to hungry agents
├─ Gold flows: agent → shop operating fund → worker wages → economy
├─ TradeCompleted event → 5% tax → Director treasury
```

### 6.4 Modifier Pipeline Flow

```
TraitResolverSystem (tick 0.5)
│
├─ For each entity with traits:
│   ├─ Load trait definitions from vault cache
│   ├─ Check conflicts (Result.err if found)
│   └─ Build modifier map: { SystemName → { key: value } }
│
├─ SeasonSystem adds seasonal modifiers (tick 17.5 previous cycle, cached)
├─ WorldEventSystem adds active event modifiers
├─ DayNightSystem adds time-of-day modifiers
│
├─ Compose all sources:
│   ├─ Rate modifiers: multiply in order (trait × season × event × daynight)
│   ├─ Flat modifiers: sum all sources
│   └─ Clamp: rates ≥ 0.0, mood external cap ±30
│
└─ Result: per-entity ModifierMap consumed by downstream systems
```

---

## 7 · Deployment View

### 7.1 Plugin Deployment

```
Build (Vite)
│
├─ Input: src/**/*.ts + configs/
├─ Output: dist/main.js (CJS bundle)
│
├─ Obsidian loads:
│   ├─ manifest.json (plugin metadata)
│   ├─ main.js (bundled plugin code)
│   └─ styles.css (if present)
│
└─ Vault structure (user's vault):
    ├── config/                    — Game configuration files
    ├── agents/                    — Agent entity markdown files
    ├── animals/                   — Animal entity files
    ├── items/                     — Item definitions
    ├── buildings/                 — Building/facility files
    ├── locations/                 — Region definitions
    ├── plots/                     — Land plot files
    ├── quests/                    — Quest definitions
    ├── graphs/                    — Canvas relationship/supply-chain graphs
    ├── chronicles/                — Chronicler narrative output
    ├── legacy/                    — Agent death biographies
    ├── scenarios/                 — Scenario definitions
    ├── templates/                 — Saved custom world templates
    ├── migrations/                — Vault version migration scripts
    ├── logs/                      — Event log files
    ├── vault-version.json         — Schema version tracking
    ├── game-config.json           — Game tuning parameters
    └── game-secrets.json          — API keys (gitignored)
```

### 7.2 System Requirements

| Resource | Minimum (300 entities) | Recommended |
|----------|----------------------|-------------|
| CPU | 4 cores | 6+ cores |
| RAM | 8 GB | 16 GB |
| GPU | Integrated (WebGL) | Dedicated for 60 FPS |
| Storage | SSD required | NVMe SSD |
| Display | 1280×720 | 1920×1080+ |
| Obsidian | v1.4+ | Latest stable |

---

## 8 · Crosscutting Concepts

### 8.1 Error Handling Strategy

All fallible operations return `Result<T, GameError>`:

```
Result.ok(value)  → success path
Result.err(error) → explicit failure, composable via map/flatMap
```

**Error boundaries:** Each tick system is wrapped in a boundary. `Result.err` → system skipped for this tick, logged, tick continues.

**Quarantine:** Invalid vault files are quarantined (tracked, not deleted). Director notified. Auto-resume on correction.

**Entity suspension:** Repeatedly failing entities are suspended from system processing. `EntitySuspended` event → Director notification. Resume on data correction.

### 8.2 Saga Pattern (Multi-Step Transactions)

Trades, construction, and agent-created quests use the Saga pattern:
- Ordered Command sequence with compensating actions
- If any step fails, all prior steps are compensated in reverse
- Guarantees atomic operations across multiple entity state changes

### 8.3 Circuit Breaker (LLM Protection)

```
Closed → (N failures) → Open → (cooldown) → Half-Open → (test call) → Closed/Open
```

All LLM calls go through the Circuit Breaker. Open state = template fallback. Events emitted on state change. Priority queue: Director dialogue (1) > Chronicler (2) > Agent-to-agent (3).

### 8.4 Data Validation Pipeline

```
Vault File → YAML Parse → Zod Schema Validate → ECS Component
                  │                 │
                  └─ Parse fail     └─ Validation fail
                     → quarantine      → quarantine
```

Zod schemas are the single source of truth for:
1. Runtime validation (safeParse)
2. TypeScript types (z.infer)
3. Documentation (self-documenting schemas)

### 8.5 Modifier Pipeline

Resolution order: Traits → Seasons → World Events → Time-of-Day.

- **Rate modifiers** (production_rate, decay rates): multiplicative composition
- **Flat modifiers** (mood_delta, gold bonuses): additive composition
- **Invariants:** Rates clamped to [0.0, ∞). External mood modifiers capped at ±30.
- **Validation:** Trait/event effects validated against enum of known system names.

### 8.6 Spatial Query Architecture

Two consumer patterns:
- **Agent BTs** read the Blackboard (populated by PerceptionSystem from SparseHashGrid)
- **Non-BT systems** query the SpatialQueryService directly (EconomySystem for hop count, JobSystem for facility lookup)

### 8.7 Persistence Model

- **Inbound:** VaultSyncSystem loads → Zod validate → ECS components. Invalid = quarantine.
- **Outbound:** Dirty-flagged components → debounced batch write (2s) → Zod validate → write. Failed = retry queue.
- **Relationship graph:** In-memory with periodic Canvas checkpoint (every 50 ticks) + on-demand export.
- **Stamina:** Runtime-only (resets to HT on session start — session gap = rest).
- **Conflict:** Last-write-wins with warning log.

### 8.8 Localization

Hybrid storage: JSON locale files for UI/entity strings, folder-based for dialogue/Chronicler templates. LLM prompts include language directive. `vue-i18n` for reactive locale switching.

### 8.9 World Health & Rubber-Banding

Composite World Health Score (mood 40%, economic velocity 30%, population stability 30%) subtly influences world event probabilities via configurable tiers. Visible in debug mode only.

### 8.10 Economy Safety Net

Three-layer death spiral recovery:
1. **Minimum treasury regen** (1 gold/day) — prevents total lockout
2. **Guaranteed recovery events** — when gold circulation drops below floor
3. **Director loans** — treasury can go negative with interest

---

## 9 · Architecture Decisions

| ADR | Decision | Rationale | Status |
|-----|---------|-----------|--------|
| ADR-01 | ExcaliburJS ECS, not custom | Built-in Entity/Component/System/Query. Validated via spike. | Accepted |
| ADR-02 | Fixed timestep accumulator | Deterministic simulation at 2 Hz, smooth rendering at 60 FPS. | Accepted |
| ADR-03 | Vault-as-database | Obsidian-native. Director can inspect/edit files. Zod validates at boundary. | Accepted |
| ADR-04 | Result type, no try/catch | Explicit error paths. Composable. Infrastructure boundary exempted. | Accepted |
| ADR-05 | EventBus with priority + batching | Loose coupling. Deterministic event delivery between systems. | Accepted |
| ADR-06 | BT + Blackboard for agent decisions | Independently testable. BT reads Blackboard, writes ActionIntent. | Accepted |
| ADR-07 | Modifier pipeline (multiplicative rates, additive flats) | Composable. Prevents stacking to impossible values via clamping. | Accepted |
| ADR-08 | Hybrid spatial model (region graph + free movement) | Strategic macro-movement + fluid micro-movement. ExcaliburJS collision for agent blocking. | Accepted |
| ADR-09 | Supply chains via quest economy | No dedicated logistics system. Facility auto-quests drive supply transport. | Accepted |
| ADR-10 | Canvas I/O optimization (periodic checkpoint) | 5000-edge relationship graph too expensive to write per-change. | Accepted |
| ADR-11 | Soft failure model (no game-over) | Director always has options. World enters "Abandoned" state, not "Game Over." | Accepted |
| ADR-12 | Pause-and-plan mode | All Director actions available while paused. Queued for next tick. | Accepted |
| ADR-13 | Chronicler as in-world entity | Onboarding + narrator + historian. Not a UI overlay — an entity that observes. | Accepted |
| ADR-14 | Tier-based gossip reliability | [1.0, 0.7, 0.5, 0.3] fixed tiers. Predictable, no float weirdness. | Accepted |
| ADR-15 | Director-spawned agents only | No immigration. Full Director control over who enters. | Accepted |
| ADR-16 | World Health rubber-banding | Invisible hand prevents runaway success and unrecoverable collapse. | Accepted |

---

## 10 · Quality Requirements

### 10.1 Quality Tree

```
Quality
├── Emergence
│   ├── 21 validation scenarios documented (GDD §1.7)
│   └── Emergence tests: seed world, run N ticks, assert patterns
├── Resilience
│   ├── Result type for all fallible ops
│   ├── Error boundaries per system
│   ├── Circuit Breaker for LLM
│   └── Entity suspension for corruption
├── Performance
│   ├── Tick < 300ms (300 entities)
│   ├── Agent BT < 2ms each
│   ├── UI reactivity < 16ms
│   └── Startup < 3s
├── Testability
│   ├── TDD methodology
│   ├── 80% coverage per system
│   ├── Seeded RNG for determinism
│   └── Balance regression golden files
└── Maintainability
    ├── ESLint architecture enforcement
    ├── Layer direction (infra → domain → UI)
    ├── Files < 350 lines, complexity < 10
    └── Frequent small commits
```

### 10.2 Quality Scenarios

| Scenario | Measure | Target |
|----------|---------|--------|
| 100 agents + 50 animals + 100 objects in one tick | Tick processing time | < 300ms |
| LLM provider goes down mid-session | Fallback to template dialogue | < 3 failures before circuit opens |
| Invalid vault file loaded at startup | Quarantined, world loads without it | 100% of invalid files quarantined |
| Director places object while paused | Object queued, appears on unpause | Action visible within 1 tick |
| Mod adds new agent kind via vault files | Agent spawnable without code changes | Zero code modifications |
| Balance parameter changed in game-config.json | Effect visible next session | No code changes needed |

---

## 11 · Risks and Technical Debt

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| ExcaliburJS performance at 300 entities | Medium | High | Dirty-flag BT evaluation, SparseHashGrid, amortized economy/events. Performance profiling built into debug mode. |
| Vault I/O bottleneck (800+ files) | Medium | Medium | Debounced batch writes, relationship graph checkpoint, startup validation on-change-only possible. |
| mistreevous library abandonment | Low | High | Library is MIT-licensed. Can fork if needed. BTs are independently testable regardless. |
| LLM cost overrun | Medium | Low | Circuit Breaker + priority queue + daily budget cap. Template fallback is full-featured. |
| Obsidian API breaking changes | Low | Medium | Plugin API is stable. Pin Obsidian version requirement in manifest. |

### 11.2 Known Gaps (deferred to implementation phases)

- Facility abstraction unification (building vs. world-object-as-vendor)
- Full undo for Director actions (only object removal is reversible currently)
- Save/load/multiple worlds management
- Agent comparison tools (sort/filter/side-by-side)
- Creative/god mode for sandbox experimentation
- Session resume briefing
- 100+ agent performance soft caps

---

## 12 · Glossary

See GDD §37 for the full glossary (42 terms). Key architecture terms:

| Term | Definition |
|------|-----------|
| **Actor** | ExcaliburJS entity with position, collision, graphics, actions. Base class for Agents, Animals, WorldObjects. |
| **Blackboard** | Per-entity key-value store populated from ECS components. BTs read only the Blackboard. |
| **Modifier Pipeline** | Composition of Trait → Season → WorldEvent → DayNight modifiers applied to system parameters. |
| **VaultSync** | Bidirectional synchronization between Obsidian vault files and ECS components. |
| **SpatialQueryService** | Stateless service populated by PerceptionSystem for non-BT system spatial lookups. |
| **UIBridge** | System that pushes ECS state diffs to Pinia stores via events + periodic snapshots. |
| **Tick** | One discrete simulation step (~500ms). All game state changes happen at tick boundaries. |
| **Quarantine** | Invalid vault files flagged and excluded from ECS loading. Director notified. |
| **Saga** | Ordered Command sequence with compensating rollback. Used for trades and construction. |
| **World Health** | Composite score (mood + economy + population) that subtly modulates event probabilities. |
