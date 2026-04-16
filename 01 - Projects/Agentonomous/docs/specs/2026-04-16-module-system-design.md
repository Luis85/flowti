---
title: Agentonomous — Module System + Observability (Increment 3)
date: 2026-04-16
status: approved-for-planning
author: Luis Mendez
project: Agentonomous
---

# Agentonomous — Module System + Observability (Increment 3)

## 1. Purpose & Scope

Increment 2 hardened the skeleton into a framework with a shell/core split, typed EventBus, Logger, ErrorHandler, and CommandRegistry. Increment 3 introduces the **module system** — the extension mechanism that lets bounded contexts (agents, economy, world) plug into the framework without editing shared files — and ships three **observability modules** as the first proof of the pattern.

**In scope**
- `Module` interface with typed settings, commands, lifecycle hooks, dependency declaration.
- Topological sort of modules by `dependsOn` with circular-dependency detection.
- Open `EventMap` via TypeScript declaration merging (modules extend from their own folders).
- Async event support (`emitAsync`) alongside existing sync `emit`.
- Listener priority on `on()`.
- `warn` log level.
- Namespaced settings: each module owns a validated, typed section of the persisted settings blob.
- Startup validation phase (dependency resolution, duplicate detection, settings validation).
- Three first modules: Core (refactor), Event Inspector (sidebar view), Health Monitor (command-only).
- Anti-pattern fixes: traceMap eviction, ViewRegistry returns Result, PluginContext wraps CorePorts, ribbon visibility moves to shell.

**Out of scope**
- Business-logic modules (agents, economy, world).
- Debug Console module (deferred).
- Module hot-reload (modules are static for the plugin's lifetime).
- Inter-module direct communication (modules communicate exclusively via EventBus).

## 2. Module Interface

### 2.1 Type definition (`src/domain/shared/module.ts`)

The collection type (`Module`) uses `unknown` for settings. A `defineModule<T>()` builder preserves compile-time type safety at the definition site while returning the erasable base type for the collection.

```ts
// Base interface — used in PluginCore's Module[] collection
interface Module {
  readonly id: string;
  readonly name: string;
  readonly dependsOn?: readonly string[];

  readonly settingsKey?: string;
  readonly settingsDefaults?: unknown;
  validateSettings?(raw: unknown): Result<unknown, string>;

  readonly commands?: readonly CommandEntry[];

  init(ports: ModulePorts, settings: unknown): Promise<void>;
  destroy(): void;
}

// Type-safe builder — preserves TSettings at definition site, erases to Module for the collection
function defineModule<TSettings = unknown>(def: {
  readonly id: string;
  readonly name: string;
  readonly dependsOn?: readonly string[];
  readonly settingsKey?: string;
  readonly settingsDefaults?: TSettings;
  validateSettings?(raw: unknown): Result<TSettings, string>;
  readonly commands?: readonly CommandEntry[];
  init(ports: ModulePorts, settings: TSettings): Promise<void>;
  destroy(): void;
}): Module {
  return def as Module;
}
```

**How it works:** Module authors call `defineModule<CoreSettings>({...})`. Inside the definition, `init(ports, settings)` has `settings: CoreSettings` — fully typed. The return type is `Module` (base), so `PluginCore` holds `Module[]` and calls `module.init(ports, validatedSettings)` where `validatedSettings` is `unknown`. The cast is encapsulated inside `defineModule` — the ONLY unsafe boundary. Module authors never see a cast.

**`PluginCore.init()` call site:**
```ts
const validated = module.validateSettings?.(raw) ?? ok(module.settingsDefaults);
// validated is Result<unknown, string> — the value is the right shape because the same module validated it
await module.init(ports, isOk(validated) ? validated.value : module.settingsDefaults);
```

The `as Module` cast in `defineModule` is the standard pattern for heterogeneous typed collections in TypeScript (same pattern NestJS and Angular use for provider registration).

### 2.2 ModulePorts — scoped subset

```ts
interface ModulePorts {
  readonly eventBus: EventBus;
  readonly logger: LoggerPort;
  readonly settings: SettingsPort;
  readonly notifications: NotificationPort;
  readonly views: ViewRegistryPort;
}
```

`ModulePorts` deliberately omits `commands` — modules declare commands as data in the `commands` array; core wires them via the `CommandPort`. Modules never call `commandPort.register()` directly.

### 2.3 Module directory convention

```
src/modules/
├── core/
│   └── core-module.ts
├── event-inspector/
│   ├── event-inspector-module.ts
│   ├── event-inspector-settings.ts
│   ├── event-inspector-store.ts
│   ├── event-inspector-events.ts      # EventMap augmentation
│   └── views/
│       └── EventInspectorView.vue
└── health-monitor/
    ├── health-monitor-module.ts
    └── health-monitor-events.ts
```

Modules live in `src/modules/` (not `src/domain/`). They span concerns — they declare domain types, commands, settings, and may have Vue views. They depend on domain ports but are not domain-pure. ESLint treats `src/modules/` like `src/core/` for `no-console` and `no-restricted-syntax` rules.

### 2.4 Module dependencies and startup ordering

Each module declares `dependsOn?: readonly string[]` — an array of module `id`s that must `init()` before this module.

`PluginCore` topologically sorts modules before calling `init()`. Circular dependencies are detected at startup validation and cause a fatal error (plugin does not proceed to `ready` state).

Topological sort is a utility in `src/domain/shared/utils/topo-sort.ts`. It returns `Result<Module[], string>` — `Ok` with sorted array or `Err` with a human-readable cycle description.

`destroy()` is called in **reverse** dependency order (dependents first, then their dependencies).

## 3. EventBus Enhancements

### 3.1 Open EventMap

`EventMap` becomes an empty extendable interface. Core channels move to a separate augmentation file:

```ts
// src/domain/shared/event-bus.ts
export interface EventMap {}

// src/domain/shared/core-events.ts
declare module './event-bus.js' {
  interface EventMap {
    log: { level: LogLevel; source: string; message: string; data?: unknown };
    error: { code: string; message: string; source: string; severity: 'user' | 'system' | 'fatal'; data?: unknown };
    settings: { previous: unknown; current: unknown };
    core: { phase: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'validation'; degraded?: boolean; errors?: string[] };
    command: { id: string; trigger: 'palette' | 'ribbon' | 'hotkey' };
  }
}
```

Module-specific events follow the same pattern:

```ts
// src/modules/event-inspector/event-inspector-events.ts
declare module '../../domain/shared/event-bus.js' {
  interface EventMap {
    'event-inspector': { action: 'buffer-full' | 'filter-changed' };
  }
}
```

### 3.2 Async events

```ts
interface EventBus {
  emit<K>(channel: K, payload: EventMap[K], opts?): EventEnvelope<K>;
  emitAsync<K>(channel: K, payload: EventMap[K], opts?): Promise<EventEnvelope<K>>;
  on<K>(channel: K, listener: (envelope: EventEnvelope<K>) => void | Promise<void>, opts?: { priority?: number }): Unsubscribe;
  onAny(listener: (envelope: EventEnvelope) => void | Promise<void>): Unsubscribe;
}
```

- `emit` (sync): fires all listeners synchronously, ignores return values. Fire-and-forget. Most common.
- `emitAsync`: **snapshots the listener set before dispatching** (copies the Set into an array), then fires all listeners and `await`s any that return a Promise. Resolves when all listeners complete. This snapshot prevents re-entrancy hazards: if a listener calls `on()` or unsubscribes during the async gap, the current dispatch is unaffected. The sync `emit` should also snapshot for consistency (a listener unsubscribing itself during iteration can cause skips in a live Set).
- Listener signature accepts `void | Promise<void>`. Sync listeners work in both `emit` and `emitAsync`. Only async-aware listeners return Promises.

### 3.3 Listener priority

```ts
on<K>(channel: K, listener, opts?: { priority?: number }): Unsubscribe;
```

Default priority `0`. Higher numbers fire first (Symfony convention). Listeners stored sorted by priority descending. Existing code passes no `opts` — no breakage.

Recommended priority ranges:
- `100`: infrastructure (ErrorHandler, security)
- `0`: feature modules (default)
- `-10`: observability (telemetry, logging)
- `-100`: debug tools (Event Inspector)

`onAny()` does NOT support priority — `onAny` listeners always fire after all channel-specific listeners, in registration order. This is by design: `onAny` is for observation, not intervention.

### 3.4 traceMap eviction

`maxTraceEntries` constant (default `10000`). When exceeded, evict the oldest 25% (2500 entries). The `Map` iteration order is insertion order in ES2015+, so evicting the first N entries via `keys().next()` is O(N). Simple and sufficient.

## 4. Logger Enhancement

### 4.1 Warn level

`LogLevel` becomes `'debug' | 'info' | 'warn' | 'error'`.

`LEVEL_ORDER`: `{ debug: 0, info: 1, warn: 2, error: 3 }`.

Logger gains:
```ts
warn(source: string, message: string, data?: unknown): void {
  if (!this.shouldLog('warn')) return;
  console.warn(`[agentonomous:${source}]`, message, data);
  this.bus.emit('log', { level: 'warn', source, message, data });
}
```

`LoggerPort` gains `warn(source, message, data?)`. `KNOWN_LOG_LEVELS` and settings tab dropdown update to include `'warn'`.

## 5. Namespaced Settings

### 5.1 MergedSettings shape

```ts
type MergedSettings = { core: CoreSettings } & Record<string, unknown>;
```

Uses an intersection (`&`) instead of an index signature to avoid the TypeScript widening issue where `core` would read as `unknown` due to the index signature `[key: string]: unknown` overriding the explicit `core` property. With the intersection, `mergedSettings.core` is properly typed as `CoreSettings` and arbitrary module keys are accessed via `Record<string, unknown>` on the intersection side.

`CoreSettings` is the renamed `PluginSettings`:
```ts
type CoreSettings = {
  readonly showRibbonIcon: boolean;
  readonly defaultView: DefaultViewName;
  readonly logLevel: LogLevel;
};
```

### 5.2 Startup settings flow

1. `SettingsPort.load()` returns raw `unknown` blob from Obsidian's `loadData`.
2. `PluginCore` extracts `raw.core` → validates via Core module's `validateSettings`.
3. For each module with `settingsKey`: extracts `raw[module.settingsKey]` → calls `module.validateSettings(section)`.
4. Missing or invalid section → fall back to `module.settingsDefaults`.
5. Validated `MergedSettings` cached in `PluginCore`.
6. Each module's `init(ports, settings)` receives its own typed, validated section — modules never see other modules' settings.

### 5.3 Settings change flow

When a module's settings section changes:
1. The module calls `ports.settings.save(mergedSettings)` (core manages the merge).
2. `PluginCore` re-validates the changed section.
3. Emits `settings` event on the bus with the full `previous`/`current` merged objects.
4. Modules subscribe to `settings` and filter for changes to their own key.

### 5.4 Settings tab integration

`AgentonomousSettingsTab` renders sections per module. Each module can optionally declare:
```ts
renderSettings?(containerEl: HTMLElement, current: TSettings, save: (next: TSettings) => Promise<void>): void;
```

If absent, the module has no settings UI. Core settings render first; module settings below in dependency order.

### 5.5 Migration

- `PluginSettings` → renamed to `CoreSettings`.
- `DEFAULT_SETTINGS` → `CORE_SETTINGS_DEFAULTS`.
- `validateSettings` → `validateCoreSettings`.
- `SettingsPort` interface: the `save()` method signature changes from accepting `PluginSettings` to accepting `unknown` (the merged settings blob). The `load()` return type becomes `Promise<Result<unknown, string>>` — the core validates and narrows sections. This is a breaking change to the port interface. Update `ObsidianSettingsAdapter`, `useSettingsStore`, and the settings-tab accordingly.
- Persisted data migration: if saved data is flat (no `core` wrapper), the startup flow detects this and wraps it: `{ core: existingFlatData }`. Backward-compatible.

## 6. Startup Validation

Between module collection and `init()`, `PluginCore` runs `validate()`:

1. **Dependency resolution** — topological sort. Fatal on circular deps or unknown dependencies.
2. **Duplicate detection** — two modules with same `id`, `settingsKey`, or command `id` → fatal.
3. **Settings schema validation** — each module's validator runs. Non-fatal (warn + fallback to defaults).
4. **All validation errors collected** — the full list is emitted as a `core` event with phase `'validation'` and logged at `warn`/`error` level. Developer sees everything wrong in one pass.

Fatal errors prevent `init()` — plugin emits `core:ready` with a degraded flag in the payload: `{ phase: 'ready', degraded: true, errors: string[] }`. Non-fatal issues log and continue.

Update `core` event payload to support the degraded case:
```ts
core: { phase: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'validation'; degraded?: boolean; errors?: string[] };
```

## 7. First Modules

### 7.1 Core module (`src/modules/core/`)

Refactors existing settings/lifecycle into a Module. The "zero module" that proves the pattern.

```ts
const CoreModule: Module<CoreSettings> = {
  id: 'core',
  name: 'Core',
  dependsOn: [],
  settingsKey: 'core',
  settingsDefaults: CORE_SETTINGS_DEFAULTS,
  validateSettings: validateCoreSettings,
  commands: CORE_COMMANDS,
  async init(ports, settings) {
    ports.logger.info('core', 'Core module initialized');
  },
  destroy() {},
};
```

### 7.2 Event Inspector module (`src/modules/event-inspector/`)

**Settings:**
```ts
type EventInspectorSettings = {
  readonly enabled: boolean;
  readonly maxEvents: number;
  readonly filterChannels: string[];
};
```

Defaults: `{ enabled: true, maxEvents: 500, filterChannels: [] }` (empty = all channels).

**Behavior:**
- On `init()`, subscribes to `bus.onAny()` at priority `-100` (lowest — fires after all feature listeners).
- Captures each `EventEnvelope` into a ring buffer capped at `maxEvents`.
- Groups events by `traceId` for chain visualization.
- Exposes buffer via a Pinia store (`useEventInspectorStore`) inside the module folder.

**View:** Right sidebar panel via view registry.

```ts
commands: [
  {
    id: 'toggle-event-inspector',
    name: 'Toggle event inspector',
    opensView: VIEW_TYPE_EVENT_INSPECTOR,
    ribbon: { icon: 'activity', title: 'Event inspector', visibleByDefault: false },
  },
],
```

**UI:** Scrollable list of events (newest at top). Each row: `[timestamp] channel: payload-summary`. Click to expand full payload + trace chain. Filter bar at top. Styled with Obsidian CSS variables.

**This module proves:** module registration, namespaced settings, sidebar view, `onAny()` consumer, Pinia store inside a module.

### 7.3 Health Monitor module (`src/modules/health-monitor/`)

**No settings** (no `settingsKey`).

**Behavior:**
- Subscribes to `core:*` events, tracks module lifecycle states in a `Map<moduleId, { state, initDuration, error? }>`.
- Tracks `traceMap` size via periodic self-emit (every 60s, `bus.emit('core', { phase: 'health-check' })`).

**Command (no view):**
```ts
commands: [
  {
    id: 'show-health',
    name: 'Show health status',
  },
],
```

The command callback logs a structured summary and shows a Notice:
```
[agentonomous:health] Modules: core(ready, 12ms), event-inspector(ready, 3ms), health-monitor(ready, 1ms)
[agentonomous:health] EventBus: 142 events, 38 traces, traceMap: 142/10000
[agentonomous:health] Settings: valid (3 sections)
```

The Health Monitor's 60-second periodic emit uses `setInterval` — the module's `destroy()` MUST call `clearInterval` to prevent leaks after plugin unload:

```ts
destroy() {
  if (this.intervalId !== null) clearInterval(this.intervalId);
}
```

**This module proves:** command-only module (no view, no settings), module observing lifecycle events, periodic sampling with proper interval cleanup.

## 8. Anti-Pattern Fixes

| Issue | Fix |
|-------|-----|
| `traceMap` unbounded growth | `maxTraceEntries = 10000`, evict oldest 25% on overflow |
| `ViewRegistry.openView` throws | Returns `Promise<Result<void, string>>`. Callers handle `err` via the bus. |
| `PluginContext` / `CorePorts` overlap | `PluginContext = CorePorts & { readonly app: App; readonly plugin: Plugin }`. One source of truth. |
| `setRibbonVisibility` on `CommandPort` | Removed from interface. `ObsidianCommandAdapter.setRibbonVisibility()` is a concrete method. The adapter subscribes to `settings` events on the bus in `main.ts` and toggles visibility itself — no core involvement. **Lifecycle note:** the adapter subscribes BEFORE `PluginCore.init()` is called, so it sees all settings events including those emitted during init. Additionally, the adapter reads the initial `showRibbonIcon` value from `PluginCore.settings` immediately after `init()` completes and applies it — this covers the case where saved settings have `showRibbonIcon: false` but `visibleByDefault: true` in the command entry. Without this initial sync, the ribbon would briefly show then hide only on the next settings change. |

## 9. File Inventory

### 9.1 New files

```
src/domain/shared/
├── module.ts                    # Module, ModulePorts interfaces
├── core-events.ts               # EventMap augmentation for core channels
└── utils/
    └── topo-sort.ts             # topologicalSort() utility

src/modules/
├── core/
│   └── core-module.ts           # CoreModule definition
├── event-inspector/
│   ├── event-inspector-module.ts
│   ├── event-inspector-settings.ts
│   ├── event-inspector-events.ts
│   ├── event-inspector-store.ts
│   └── views/
│       ├── EventInspectorView.vue
│       └── event-inspector-view.ts   # ItemView subclass
└── health-monitor/
    ├── health-monitor-module.ts
    └── health-monitor-events.ts

src/infrastructure/obsidian/
└── (existing adapters — no new files, modifications only)
```

### 9.2 Modified files

```
src/domain/shared/event-bus.ts         # Empty EventMap, emitAsync, priority, traceMap eviction
src/domain/shared/logger-port.ts       # Add warn()
src/domain/settings/plugin-settings.ts # Rename to CoreSettings
src/core/plugin-core.ts                # Module orchestration, startup validation
src/core/logger.ts                     # Add warn(), update LEVEL_ORDER
src/main.ts                            # Pass modules, ribbon visibility via bus subscription
src/plugin.ts                          # PluginContext = CorePorts & { app, plugin }
src/infrastructure/obsidian/view-registry.ts  # openView returns Result
src/infrastructure/settings/settings-tab.ts   # Module-scoped sections
configs/eslint.config.mjs              # src/modules/ rules
```

## 10. Acceptance Criteria

### 10.1 Module system

1. Three modules load successfully: `npm test` includes a headless `PluginCore` test with all three modules booting in correct dependency order.
2. Circular dependency detection: a test passes two mutually-dependent modules and verifies the fatal error message.
3. Duplicate command-id detection: a test verifies the validation catches it.

### 10.2 EventBus enhancements

4. `emitAsync` awaits all listener Promises before resolving.
5. Listener priority: a test registers listeners at priority 100, 0, -100 and verifies execution order.
6. `traceMap` eviction: a test emits 10,001 events and verifies the map size is ≤10,000.
7. `EventMap` augmentation: the Event Inspector module's channel is type-safe at compile time.

### 10.3 Logger

8. `logger.warn()` emits to console.warn + bus `log` channel with `level: 'warn'`.
9. Settings tab shows 4-level dropdown (debug/info/warn/error).

### 10.4 Observability modules

10. Event Inspector: opening the sidebar view shows a live event list. Emitting events from tests causes the list to update.
11. Health Monitor: running the `show-health` command logs module states + bus stats.

### 10.5 Settings

12. Settings persist as namespaced `{ core: {...}, eventInspector: {...} }`.
13. Loading flat legacy settings (no `core` wrapper) auto-migrates to namespaced format.

### 10.6 Anti-pattern fixes

14. `ViewRegistry.openView` returns `Result` — verified by test.
15. `PluginContext` extends `CorePorts` — compile-time verified.
16. `CommandPort` has no `setRibbonVisibility` — compile-time verified.

### 10.7 Quality gates

17. `npm test` green, test count grows to ~140+.
18. Coverage thresholds met (80/70/80/80).
19. ESLint enforces: `src/modules/` has `no-console: 'off'`, `no-restricted-syntax: 'off'`.

## 11. Risks

- **Module augmentation path sensitivity** — `declare module './event-bus.js'` must use the exact module specifier (with `.js` suffix in NodeNext). If the path drifts, augmentations silently stop merging. Mitigated by tests that verify channel registration for each module.
- **Namespaced settings migration** — existing users who already saved settings get flat data. The auto-migration wrapping must be tested with real Obsidian `loadData` output. Mitigated by a dedicated migration test.
- **Event Inspector performance** — `onAny()` fires on every event. With high-frequency agent ticks, the ring buffer insertion becomes a hot path. Mitigated by the `enabled` setting (can be turned off) and the priority `-100` (fires last, after all critical listeners).

## 12. Next Step

After this spec is approved, the `writing-plans` skill produces the implementation plan.
