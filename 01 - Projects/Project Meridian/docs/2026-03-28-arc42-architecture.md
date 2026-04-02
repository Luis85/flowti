# Project Meridian — Arc42 Architecture Document

> Derived from: Game Design Document (Project Meridian.md), Player Depth Design Spec, Phase 0 Implementation Plans
> Version: 1.1.0 | Date: 2026-04-02 (updated from 1.0.0 2026-03-28)

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
| 5 | **Performance** | 300 entities processed within a 300ms tick budget (within 500ms tick interval) |

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
| **ExcaliburJS v0.32+** | Game engine. Provides ECS, Actor, collision, rendering, camera, input. Already validated via spike. |
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
│       │             │ (34 slots)  │     │
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
| **BT + BehaviorAgent** | mistreevous MDSL behavior trees with typed BehaviorAgent interface (replaces untyped blackboard). Layered BT composition (shared base + per-role branch). RUNNING state eliminates oscillation bugs. Agent condition/action methods proxy ECS component state. |
| **Dual rendering: ExcaliburJS + Vue** | ExcaliburJS renders the world map. Vue renders the management sidebar. Pinia stores bridge ECS → Vue via UIBridgeSystem. |
| **Circuit Breaker for LLM** | LLM failures don't cascade. Template fallback activates seamlessly. Priority queue: Director > Chronicler > agent-to-agent. |
| **Seeded RNG for test determinism** | All random decisions consume from injectable GameRNG. Fixed seeds in tests, Math.random in production. |

### 4.2 Technology Mapping

| Layer | Technology | Role |
|-------|-----------|------|
| Platform | Obsidian Plugin API | Host environment, vault persistence, file system |
| Runtime/ECS | ExcaliburJS v0.32+ | ECS, Actor, Actions API, collision (SparseHashGrid), camera, EventEmitter, Timer, scenes, debug, input, graphics (WebGL + Canvas fallback) |
| Pathfinding | @excaliburjs/plugin-pathfinding [Phase 2+] | A* and Dijkstra for region graph navigation |
| BT Engine | mistreevous 4.3.1 | MDSL behavior tree engine with RUNNING state, guards, parallel nodes. BehaviorAgent typed interface replaces untyped blackboard. (src/domain/systems/behavior-agent.ts) |
| Priority Queue | flatqueue (~600B) | Binary min-heap for amortized price recalculation scheduling in EconomySystem |
| Data Structures | mnemonist (tree-shakeable) | CircularBuffer for agent price memories (fixed-size, oldest evicted) |
| UI Framework | Vue 3 (Composition API) [Phase 8+] | Management sidebar (collapsible sections) |
| State Management | Pinia [Phase 8+] | Reactive stores bridging ECS → Vue |
| Validation | Zod | Schema definition, runtime validation, TypeScript type inference |
| Persistence | Obsidian Vault (markdown + Canvas + JSON) | Data-driven world definition and state |
| LLM | Unified LLMProvider interface | Optional dialogue enrichment (Cursor API first) |
| i18n | vue-i18n [Phase 8+] | Reactive locale switching for Vue UI |
| Testing | Vitest + memfs | Unit, integration, emergence (Vue Test Utils + MSW: Phase 8+) |
| Component Dev | Storybook [Phase 8+] | Isolated Vue component development |
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
│  Layer direction: Infrastructure → Domain (core + schemas + systems) → UI │
│  Domain core: interfaces (Result, EventBus, Logger, PlatformServices)     │
│  Domain schemas: Zod schemas (pure data definitions)                      │
│  Domain systems: tick-processing units (consume components, emit events)  │
│  Domain NEVER imports Infrastructure or UI                                │
│  UI NEVER imports Domain internals (uses Pinia stores)                    │
│  Systems NEVER import other systems (use EventBus)                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Level 2 — Domain Layer

```
domain/
├── core/
│   ├── result.ts           — Result<T, E> with map/flatMap
│   ├── events.ts           — GameEvent, EventHandler, EventBus interface
│   ├── logger.ts           — Logger interface
│   ├── platform.ts         — PlatformServices aggregate (VaultAdapter, NotificationAdapter,
│   │                          CommandRegistry, ModalAdapter, SecretStorageAdapter)
│   ├── markdown-service.ts — MarkdownService interface (serialize, fromTemplate, renderTemplate)
│   └── settings.ts         — MeridianSettings interface + DEFAULT_SETTINGS
│
├── schemas/
│   ├── index.ts            — Barrel: re-exports all schemas, types, and range constants
│   ├── ranges.ts           — Single source of truth for all GDD balance constants
│   │                          (ATTRIBUTE_RANGE, MOOD_RANGE, TRAIT_CATEGORIES, etc.)
│   ├── common.ts           — Position, MemoryEntry, Goal, Skill, Inventory, Equipment, LLM
│   ├── agent-schema.ts     — AgentSchema (all fields reference ranges.ts constants)
│   ├── trait-schema.ts     — TraitSchema (effects, conflicts, assignable_by)
│   ├── game-config-schema.ts — GameConfigSchema (29 sections: tick, needs, stamina, economy,
│   │                            mood+buckets+skill_roll_modifiers, mortality, perception,
│   │                            day-night, gossip, status, crime, skills, rest tiers, season,
│   │                            candidate pool, world events, LLM, formulas, BT, agent creation,
│   │                            world health tiers; withDefaults() for Zod v4 cascade)
│   ├── item-schema.ts      — ItemSchema (id, name, baseValue, category with elasticity)
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
    ├── trait-resolver.ts         — Modifier map building + conflict detection
    ├── day-night.ts              — TimeOfDay flag (dawn/day/dusk/night)
    ├── needs-decay.ts            — Hunger/energy/social decay + modifiers
    ├── mood.ts                   — Mood calculation + external modifiers
    ├── memory-decay.ts           — Decay significance, pruning, min lifespan
    ├── perception.ts             — SparseHashGrid spatial queries → BehaviorAgent
    ├── behavior-agent.ts         — Typed BehaviorAgent (25 conditions, 22 actions, replaces blackboard)
    ├── movement.ts               — ActionIntent processing, region transitions, stamina
    ├── facility.ts               — Facility production, wages, auto-process, fund management
    ├── trade.ts                  — Agent-facility purchase (emits GoldFlowed + PurchaseComplete)
    ├── cargo.ts                  — Agent-carried logistics (pickup, deliver, haul routing)
    ├── rest.ts                   — Energy recovery at rest-type locations (3 tiers)
    ├── feed.ts                   — Hunger recovery at food-type locations
    ├── socialize.ts              — Social need recovery near agents
    ├── dialogue.ts               — Template + LLM dialogue
    ├── gossip.ts                 — Gossip exchange between agents
    ├── relationship.ts           — Relationship disposition updates
    ├── relationship-canvas.ts    — Canvas graph export
    ├── skill-progression.ts      — Skill-by-use progression
    ├── daily-report.ts           — Daily economy summary reporting
    ├── pricing.ts                — Price elasticity formula (scarcity × elasticity × location × pipeline)
    ├── demand-tracker.ts         — Sliding-window consumption tracking per item
    ├── price-memory.ts           — Agent price memories (staleness, best-source queries)
    ├── economy.ts                — Facility price recalculation orchestration
    ├── monetary-policy.ts        — Velocity tracking, faucet/sink ledger, tax, safety nets
    ├── food-items.ts             — Food item definitions
    ├── arrival-spread.ts         — Agent arrival positioning
    ├── crossing-point.ts         — Region crossing calculations
    ├── steering.ts               — Agent steering behaviors
    ├── pathfinding.ts            — A* region-graph pathfinding
    ├── world-validation.ts       — World state validation
    ├── quest-evaluation.ts       — [Future] Objective tracking, completion, failure
    ├── object-interaction.ts     — [Future] World object use, stock depletion
    ├── tool-execution.ts         — [Future] Vault file ops (Command pattern)
    ├── construction.ts           — [Future] Building progress, property registration
    ├── progression.ts            — [Future] XP, status evaluation
    ├── mortality-check.ts        — [Future] Starvation/despair → collapse/death/legacy
    ├── item-durability.ts        — [Future] Equipment wear, breakage, spoilage
    ├── world-event.ts            — [Future] Random event evaluation + world health modifiers
    ├── season.ts                 — [Future] Season advancement, seasonal modifier application
    ├── notification.ts           — [Future] Director alert filtering by severity
    ├── chronicler.ts             — [Future] Observation, narration, welfare quests
    ├── scenario.ts               — [Future] Goal tracking, scoring, time limits
    ├── abandonment.ts            — [Future] Facility abandonment detection
    ├── vault-sync.ts             — [Future] Bidirectional vault persistence
    └── ui-bridge.ts              — [Future] ECS → Pinia stores
```

### 5.3 Level 2 — Infrastructure Layer

```
infrastructure/
├── engine/
│   ├── game-engine.ts      — ExcaliburJS Engine factory (FitContainerAndFill, Arcade physics)
│   ├── game-view.ts        — Obsidian ItemView wrapping ExcaliburJS (error boundary)
│   ├── game-loader.ts      — Custom DefaultLoader (suppresses click prompt for Obsidian)
│   ├── world-loader.ts     — Vault → ECS entity hydration (agents, locations, traits, BTs)
│   └── batchable-event-bus.ts — EventBus with batch/flush for tick-boundary delivery
│
├── systems/                     — GameSystem wrappers (dual-layer pattern, 18 systems)
│   ├── trait-resolver-system.ts
│   ├── day-night-system.ts
│   ├── needs-decay-system.ts
│   ├── mood-system.ts
│   ├── perception-system.ts
│   ├── memory-decay-system.ts
│   ├── behavior-tree-system.ts  — Thin mistreevous step() caller
│   ├── movement-system.ts
│   ├── facility-system.ts       — Production, wages, auto-process, subsidies
│   ├── rest-system.ts
│   ├── feed-system.ts
│   ├── socialize-system.ts
│   ├── trade-system.ts          — Purchase flow, emits GoldFlowed events
│   ├── dialogue-system.ts
│   ├── gossip-system.ts
│   ├── relationship-checkpoint-system.ts
│   ├── economy-system.ts        — FlatQueue-driven price recalculation
│   └── monetary-policy-system.ts — Velocity tracking, safety net interventions
│
├── components/                  — ECS components (TrackedComponent base, 15 components)
│   ├── tracked-component.ts     — Base class with markDirty()/clearDirty()
│   ├── needs-component.ts
│   ├── mood-component.ts
│   ├── memory-component.ts
│   ├── attributes-component.ts
│   ├── social-component.ts
│   ├── traits-component.ts
│   ├── perception-component.ts
│   ├── time-component.ts
│   ├── wallet-component.ts      — Agent gold balance
│   ├── inventory-component.ts   — Agent item inventory
│   ├── facility-component.ts    — Facility stock, fund, prices, worker
│   ├── economy-component.ts     — World economy state (treasury, ledger, daily summary)
│   ├── relationship-component.ts — Agent relationship entries
│   └── stamina-component.ts     — Agent movement stamina
│
├── entity/                      — Entity constructors
│   ├── agent-actor.ts           — Agent Actor factory (with all components)
│   ├── agent-spawner.ts         — Agent spawn orchestration
│   ├── behavior-agent-factory.ts — BehaviorAgent construction from ECS components
│   ├── bt-loader.ts             — MDSL BT definition loading (base + branch composition)
│   ├── location-loader.ts       — Location entity loading
│   └── trait-loader.ts          — Trait definition loading
│
├── vault/
│   ├── frontmatter-parser.ts    — YAML frontmatter extraction (Result-based, CRLF-safe)
│   ├── vault-loader.ts          — Single-file Zod-validated loading + quarantine
│   ├── vault-directory-loader.ts — Directory scan → validated entity collection
│   ├── memfs-vault-adapter.ts   — In-memory VaultAdapter for testing
│   ├── obsidian-vault-adapter.ts — [Phase 9] Obsidian file system adapter
│   └── quarantine.ts            — Invalid file tracking (add, has, clear, dedup)
│
├── config/
│   └── game-config-loader.ts    — [Phase 0E] JSON → Zod validate → GameConfig
│
├── event-bus.ts    — EventBus implementation (priority, history, filter; batching deferred to tick loop)
│
├── logger/
│   ├── console-logger.ts   — Dev logging (level-filtered, structured, configurable via settings)
│   └── vault-logger.ts     — [Phase 9] Vault file logging target
│
├── performance/
│   └── performance-tracker.ts — Per-system tick timing with history and averages
│
├── settings/
│   └── settings-tab.ts     — Obsidian PluginSettingTab (log level, debug mode, perf tracking)
│
└── llm/
    ├── llm-provider.ts     — [Phase 11] Unified LLMProvider interface
    ├── cursor-provider.ts  — [Phase 11] Cursor API implementation
    └── circuit-breaker.ts  — [Phase 11] Circuit Breaker wrapper
```

**Dual-Layer System Pattern:** Every game system has a pure domain function (e.g., `applyNeedsDecay()` in `domain/systems/needs-decay.ts`) and a corresponding infrastructure wrapper (e.g., `createNeedsDecaySystem()` in `infrastructure/systems/needs-decay-system.ts`) that reads ECS components, calls the pure function, writes results back, and emits events. This separation keeps domain logic independently testable without ECS or EventBus dependencies.

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
│   ├─ FacilitySystem (6)            — Facility-driven production, wages, facility fund
│   ├─ RestSystem (6.5)             — Recovers energy at rest-type locations (3 tiers)
│   ├─ FeedSystem (6.6)             — Recovers hunger at food-type locations (requires seek_food action)
│   ├─ SocializeSystem (6.7)        — Recovers social near agents, creates mutual memories
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
│   ├─ EconomySystem (16)           — FlatQueue-driven facility price recalculation, demand tracking
│   ├─ MonetaryPolicySystem (16.5)  — Velocity tracking, snapshot write, safety net interventions
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
Farm (FacilitySystem tick 6)
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

Mill (FacilitySystem tick 6)
├─ Miller on shift → wheat available → recipe executes → flour produced

Bakery (same pattern)
├─ Flour → bread via recipe

Shop (FacilitySystem tick 6)
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

### 6.5 VaultSync Bidirectional Flow

```
STARTUP (load-only):
  Vault files → VaultAdapter.listFiles() → for each file:
    → VaultAdapter.readFile() → parseFrontmatter() → Zod safeParse()
      → OK: create ECS Entity/Actor with components
      → ERR: quarantine file, log warning, emit notification
  → Full world loaded in ECS. Target: < 3s.

INBOUND (external changes — Phase 9):
  Obsidian file watcher detects change
    → VaultAdapter.readFile() → parseFrontmatter() → Zod safeParse()
      → OK: update ECS component, emit ExternalChangeDetected
      → ERR: quarantine, notify Director

OUTBOUND (dirty entity persistence):
  Each tick: systems modify components → dirty flag set
  VaultSyncSystem (tick 19): collect dirty entities
    → Zod safeParse (validate before write)
    → VaultAdapter.writeFile() (debounced 2s batch)
      → OK: clear dirty flag
      → ERR: retry queue, emit VaultSyncFailed

SHUTDOWN:
  → Flush all dirty entities immediately (no debounce)
  → Relationship graph: full Canvas export
  → Target: < 1s
```

### 6.6 Agent BT Decision Loop

```
PerceptionSystem (tick 3)
│ Updates BehaviorAgent perception state from ECS spatial queries:
│   nearbyLocations, nearbyAgents (via SparseHashGrid)
│
BehaviorTreeSystem (tick 5)
│ For each agent with a BehaviourTree:
│   ├─ Call tree.step() — mistreevous evaluates MDSL tree
│   │   BehaviorAgent provides typed condition/action methods:
│   │   Conditions: IsHungry(), IsExhausted(), HasFood(), CanAffordFood(),
│   │     IsAtFoodFacility(), IsAtRestFacility(), IsAtWorkFacility(), etc.
│   │   Actions: Eat(), Rest(), Buy(), Work(), PickupCargo(), DeliverCargo(),
│   │     Patrol(), SeekFood(), SeekRest(), SeekWork(), Idle(), etc.
│   │
│   ├─ MDSL tree structure (base + per-role branch):
│   │   1. Survival (critical hunger → seek food → buy → eat)
│   │   2. Rest (critical energy → seek rest → rest)
│   │   3. Role branch (guard/merchant/artisan/scholar)
│   │   4. Idle (wander)
│   │
│   └─ Actions return RUNNING (in progress) or SUCCEEDED/FAILED
│      → Systems execute effects on the next tick
│
MovementSystem (tick 5.5)
│ Processes movement targets set by BehaviorAgent actions
│   → ExcaliburJS Actions API for pathfinding
│   → Stamina deduction per hop
│
Downstream systems (tick 6-18)
│ Process signals from BehaviorAgent action methods:
│   FacilitySystem — production, wages, auto-process, subsidies
│   RestSystem — energy recovery at rest locations
│   FeedSystem — hunger recovery from food inventory
│   TradeSystem — purchase flow (gold exchange, inventory, GoldFlowed events)
│   DialogueSystem — social dialogue
│   GossipSystem — information exchange
│   EconomySystem (16) — price recalculation via demand tracking
│   MonetaryPolicySystem (16.5) — velocity monitoring, safety nets
```

### 6.7 Director Quest Creation Flow

```
Director opens Quest Creator in management sidebar
│
├─ UI form: title, type, objectives, prerequisites, rewards, time limit
├─ Reward funded from Director treasury
├─ Dispatch DirectorAction { type: 'CreateQuest', questData }
│
├─ [If paused: queue for next tick]
│
├─ Tick: DirectorActionHandler processes queue
│   ├─ Validate treasury >= reward gold
│   ├─ Create quest markdown via VaultSync
│   ├─ Post to billboard (quest status: 'available')
│   ├─ Deduct treasury gold
│   ├─ Emit QuestCreated event
│   └─ Chronicler logs: "New quest posted: {title}"
│
├─ Next BT evaluation: agents near billboard evaluate quest
│   ├─ Score: (reward × goal_weight) - estimated_cost
│   ├─ Mood gates: distressed agents reject low-reward
│   └─ Best-scoring agent accepts → QuestAssigned event
│
├─ Agent pursues objectives (BT priority 4)
│   ├─ Move to targets, use tools, interact with agents
│   ├─ QuestEvaluationSystem tracks completion
│   └─ QuestCompleted → reward distributed, XP gained, memory logged
│
└─ Chronicler narrates outcome. Director observes in sidebar.
```

### 6.8 Implementation Phasing Roadmap

```
Phase 0: Foundation          ← COMPLETE
Phase 1: Agent Core          ← COMPLETE (1A tick, 1B systems, 1C agency, 1D consequences)
Phase 2: Spatial + Economy   ← SUBSTANTIALLY COMPLETE
  - Perception, movement, pathfinding: done
  - Facility production, wages, auto-process: done
  - Trade system with GoldFlowed events: done
  - BT migration to mistreevous: done (BehaviorAgent typed interface)
  - Supply chain logistics (agent-carried cargo): done
  - Economy depth (pricing, demand, monetary policy): done (domain + infra)
  - Remaining: BehaviorAgent price memory integration, dynamic pricing in BT
Phase 3: Social              ← PARTIALLY COMPLETE (dialogue, gossip, relationship systems exist)
Phase 4: Items & Equipment
Phase 5: Economy (advanced)  ← See remaining items below
Phase 6: Quests + Scenarios
── VERTICAL SLICE GATE ──    ← First playable build
Phase 7: Property
Phase 8: Director UI
Phase 9: Persistence (bidirectional)
Phase 10: Animals
Phase 11: LLM
Phase 12: World Events + Seasons
Phase 13: Polish
```

**Implementation progress (2026-04-02):** 18 infrastructure system wrappers registered. 34 SystemPriority slots defined. 30 domain system files, 11 schema files, 15 components, 6 entity files. ~500 tests across 86 test files.

**Economy depth remaining items (deferred from economy-depth plan):**
- Wire `priceMemories` CircularBuffer into BehaviorAgent
- Add `KnowsFoodSource()` / `CanAffordRememberedFood()` / `SeekBestFoodSource()` conditions to BehaviorAgent
- Update `Buy()` action to record price memories on completion
- Update MDSL trees to use remembered-price variants
- Add `category` field to item data files (schema exists, data not tagged)
- Wire `getEffectiveTaxRate()` into tax collection path (domain function exists, not consumed)
- Emit `GoldFlowed` from all gold-moving systems (only trade done — wages, stipends, welfare, rest missing)
- Infrastructure test for MonetaryPolicySystem wrapper

**Vertical Slice exit criteria:** 5 agents with BT, 1 supply chain, 3 job types, quest creation/completion, basic UI (map + sidebar), Chronicler onboarding, treasury with tax, gossip, VaultSync persistence, 3 emergence tests passing.

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
| OS | Windows 10+, macOS 12+, Linux (any Obsidian-supported) | Same |
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

### 8.2 Saga Pattern (Multi-Step Transactions) [Phase 5+]

> **Note:** Phase 5+ — not yet implemented. Design is validated but no production code exists.

Trades, construction, and agent-created quests use the Saga pattern:
- Ordered Command sequence with compensating actions
- If any step fails, all prior steps are compensated in reverse
- Guarantees atomic operations across multiple entity state changes

### 8.3 Circuit Breaker (LLM Protection) [Phase 5+]

> **Note:** Phase 5+ — not yet implemented. Design is validated but no production code exists.

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
- **Non-BT systems** query the SpatialQueryService directly (EconomySystem for hop count, FacilitySystem for facility lookup)

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

### 8.11 Seeded RNG

All systems consuming randomness (gossip probability, crime opportunity, world events, candidate pool generation) must use an injectable `GameRNG` interface:
- **Production:** `Math.random()`
- **Tests:** Seeded RNG for deterministic outcomes
- Crosscutting architectural constraint enforced at code review.

### 8.12 Dirty-Flag Optimization

High-frequency systems (BT evaluation, UIBridge snapshots) use dirty flags to skip unchanged entities:
- ECS components set a dirty flag when modified
- BehaviorTreeSystem skips agents whose Blackboard inputs haven't changed since last evaluation
- UIBridgeSystem skips clean entities during periodic snapshot reconciliation
- VaultSyncSystem only persists dirty entities

### 8.13 Candidate Pool System

Candidate pool generation spans multiple systems:
- **ChroniclerSystem** (tick 18.5): generates 3-5 pre-rolled candidates every N days
- **EconomySystem** provides: job vacancy data for weighted generation (first 2 weighted, rest random)
- **Director treasury**: creation fee deducted on hire
- **CandidatePoolRefreshed** event emitted on refresh
- Candidates stored as transient data (not vault files until hired)

### 8.14 Build Pipeline

```
npm test
├── npm run lint        → ESLint with architecture enforcement
├── npm run typecheck   → tsc --noEmit (strict mode)
└── npm run test:unit   → Vitest (80% coverage gate)

npm run build
└── Vite → CJS bundle (main.js) for Obsidian
    ├── External: obsidian, electron
    └── Output: dist/main.js + dist/styles.css

Distribution:
├── Obsidian Community Plugins (when mature)
└── GitHub Releases (manual install)
```

### 8.15 Data-Driven Test Strategy

All GDD balance values (ranges, enums, defaults) live in `src/domain/schemas/ranges.ts`. Schemas and tests both import from this single source. Tests verify code behavior against imported constants, never hardcoded magic numbers:

```
ranges.ts (constants) → Schemas (min/max/enum) → Tests (RANGE.max + 1 = rejected)
                      → Tick systems (thresholds)
                      → Future: game-config overrides
```

**Rebalancing workflow:** Change constant in `ranges.ts` → schemas, tests, and systems all follow. Zero test updates needed.

**Test categories:**
- Schema tests: validation accepts/rejects at boundaries, defaults apply (data-driven)
- Infrastructure tests: code behavior (event delivery, logging, vault loading) — no GDD values
- System tests (future): tick behavior with mock components — import constants for thresholds
- Emergence tests (future): world-level scenarios — use `createTestWorld()` helpers

### 8.16 ESLint Architecture Enforcement

63 rules on `src/` (28 TypeScript + 25 Obsidian + 10 base), 27 rules on `tests/` (24 TypeScript + 3 base). All type-aware via `tsconfig.lint.json`.

**Architecture boundaries (enforced at lint time):**
- Domain must not import infrastructure, `obsidian`, `node:*`, or `excalibur`
- UI must not import domain internals (uses Pinia stores)
- `obsidian` import allowed only in: `main.ts`, `plugin.ts`, `*-view.ts`, `settings-tab.ts`, `obsidian-*-adapter.ts`

**Agentic code quality rules:** `no-floating-promises`, `no-unsafe-*` (5 rules), `no-misused-spread`, `restrict-template-expressions`, `no-unnecessary-condition`, `prefer-nullish-coalescing`, `consistent-type-imports`, `only-throw-error`, `return-await`. These catch the specific mistakes AI code generation tools tend to make.

**Test-specific relaxations:** `no-unsafe-assignment` off (mocks), `require-await` off (async interface implementations), `no-unnecessary-condition` off (type-narrowing assertions), `varsIgnorePattern: ^_` (omit-via-destructure).

### 8.17 GameCoreDeps — Dependency Injection Container

All systems receive `GameCoreDeps` which provides:
- `logger` (hot-swappable) — replaced at runtime when settings change
- `eventBus` (readonly) — shared EventBus instance
- `config` (readonly reference, mutable properties) — game configuration
- `performanceTracker` (hot-swappable) — replaced at runtime when settings change
- `tickCount` (set per-tick) — current simulation tick number

`applySettings()` in `plugin.ts` mutates `config` properties and replaces `logger`/`performanceTracker` at runtime. Because the `config` object reference is readonly but its properties are mutable, all systems see updated values immediately without re-injection.

### 8.18 TrackedComponent Pattern

All mutable ECS components extend `TrackedComponent` which provides `markDirty()`/`clearDirty()`. Systems must call `markDirty()` after any state mutation. Dirty flags serve two purposes:
1. **Skip optimization** — systems like BehaviorTree and UIBridge skip processing clean entities
2. **VaultSync optimization** — only dirty entities are persisted (Phase 9)

### 8.19 MeridianTickSystem — ExcaliburJS Bridge

`MeridianTickSystem extends excalibur.System` bridges the ExcaliburJS render loop with the domain tick scheduler. Uses a fixed-timestep accumulator with configurable interval and `maxCatchUp = 3` to prevent spiral-of-death (where slow ticks cause the accumulator to grow unboundedly, triggering more ticks and further slowing the system). The accumulator resets when the tick interval changes to prevent stale velocity integration from the previous interval.

### 8.20 Obsidian Plugin Lifecycle

```
onload():
├── loadSettings() → merge loadData() with DEFAULT_SETTINGS
├── Create logger (configurable level from settings)
├── Create performance tracker (toggleable from settings)
├── registerView() → MeridianGameView factory
├── addRibbonIcon() → open/focus game view
├── addSettingTab() → MeridianSettingsTab (runtime settings apply)
└── onLayoutReady() → initializeGame() (deferred heavy init)

applySettings() (called when user changes settings):
├── Recreate logger with new level
└── Recreate performance tracker with fresh logger reference

MeridianGameView.onOpen():
├── Create ExcaliburJS engine (FitContainerAndFill, Arcade physics)
├── Error boundary: try/catch → showError() on failure
└── Fire-and-forget engine.start(loader)

onunload():
└── No-op — Obsidian handles leaf reinit during plugin updates
```

---

## 9 · Architecture Decisions

| ADR | Decision | Rationale | Status |
|-----|---------|-----------|--------|
| ADR-01 | ExcaliburJS ECS, not custom | Built-in Entity/Component/System/Query. Validated via spike. | Accepted |
| ADR-02 | Fixed timestep accumulator | Deterministic simulation at 2 Hz, smooth rendering at 60 FPS. | Accepted |
| ADR-03 | Vault-as-database | Obsidian-native. Director can inspect/edit files. Zod validates at boundary. | Accepted |
| ADR-04 | Result type, no try/catch | Explicit error paths. Composable. Infrastructure boundary exempted. | Accepted |
| ADR-05 | EventBus with priority + batching | Loose coupling. Deterministic event delivery between systems. | Accepted |
| ADR-06 | BT + Blackboard for agent decisions | Independently testable. BT reads Blackboard, writes selectedAction. Event type is `BTActionSelected` (not `ActionIntent`). **Amendment (2026-03-29):** Custom pure-function BT evaluator (`evaluateBT()`) used instead of mistreevous. 4 node types (action, condition, selector, sequence) cover Phases 0–1D. mistreevous remains the target if complexity warrants it at Phase 3+ (parallel, decorator, guard nodes). Review gate at Phase 3 (Social). | Accepted |
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
| ADR-17 | Pinia as UIBridge intermediate layer | Vue components read Pinia stores, not EventBus directly. Stores aggregate events + periodic snapshots, providing reactive state that survives component remounting. Decouples UI lifecycle from simulation lifecycle. | Accepted |
| ADR-18 | PlatformServices aggregate in platform.ts | All platform abstractions (VaultAdapter, NotificationAdapter, CommandRegistry, ModalAdapter, SecretStorageAdapter) co-located. ISP subsets injected per consumer. | Accepted |
| ADR-19 | Obsidian isolation boundary (ESLint-enforced) | `obsidian` import restricted to allowlist files only. Prevents platform API leakage into domain/infrastructure. | Accepted |
| ADR-20 | ranges.ts as balance constant source of truth | All GDD numeric ranges and enums centralized. Schemas, tests, and future systems import from one file. Rebalancing = one constant change. | Accepted |
| ADR-21 | Synchronous EventBus with deferred batching | EventBus dispatches synchronously. Batching (queue during system, flush between systems) deferred until tick loop exists. Interface stable either way. | Accepted |
| ADR-22 | Zod v4 with v3-compatible API surface | Project uses Zod v4 (`z.ZodType` not `ZodSchema`, explicit key in `z.record()`, full defaults for nested objects). API patterns validated during Phase 0. | Accepted |
| ADR-23 | Facility-driven production (FacilitySystem) | Production iterates facilities, not agents. Agents are labor — facilities are units of production with their own state (stock, fund, progress). Uses existing JOB priority slot (6). GDD's JobSystem scope (shifts, service jobs) deferred to Phase 5. | Accepted |

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
| 100 agents + 50 animals + 100 objects + 50 misc in one tick | Tick processing time | < 300ms |
| LLM provider goes down mid-session | Fallback to template dialogue | < 3 failures before circuit opens |
| Invalid vault file loaded at startup | Quarantined, world loads without it | 100% of invalid files quarantined |
| Director places object while paused | Object queued, appears on unpause | Action visible within 1 tick |
| Mod adds new agent kind via vault files | Agent spawnable without code changes | Zero code modifications |
| Balance parameter changed in game-config.json | Effect visible next session | No code changes needed |
| Two agents with negative history meet | BT avoids asking for help (seeded RNG) | Deterministic with fixed seed |
| Death spiral: gold circulation drops below floor | Guaranteed recovery event fires | Within 1 WorldEvent evaluation cycle |
| Gossip passes through 4 agents | Reliability degrades to 0.3 at 4th hop | Exact tier match [1.0, 0.7, 0.5, 0.3] |
| Close vault, reopen | World state matches last VaultSync | Within 1 tick of shutdown state |
| Balance regression: 1000 ticks with fixed seed | Aggregate metrics (mood, gold, quests) | Within ±5% of golden file |
| Plugin startup with 350 vault files | Time from onload() to world ready | < 3s |
| Plugin shutdown | Flush dirty state, clean up | < 1s |
| Coverage per system | Statements and lines | ≥ 80% statements, ≥ 80% lines |

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
