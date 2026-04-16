---
title: Agentonomous — Framework Hardening Design (Increment 2)
date: 2026-04-16
status: approved-for-planning
author: Luis Mendez
project: Agentonomous
---

# Agentonomous — Framework Hardening Design (Increment 2)

## 1. Purpose & Scope

Increment 1 shipped the target architecture skeleton — three-layer DDD split, Vue 3 presentation, Obsidian plugin boilerplate. Increment 2 hardens that skeleton into a **framework**: a stable, well-bounded foundation that enforces good patterns by design, not by discipline.

**In scope**
- Shell/core split: thin Obsidian shell (`main.ts`) + platform-agnostic `PluginCore` engine.
- Typed EventBus with namespaced channels, tracing (traceId/parentId), and `onAny()` for centralized debug logging.
- Command-centric registry with optional ribbon + view hints.
- Structured logging via `LoggerPort` (console + bus dual-output, level-gated, configurable in settings).
- Central `ErrorHandler` subscribing to `error:*` channel, routing by severity to logger + `NotificationPort`.
- Lean shared utilities: `generateId`, `timestamp`, `isOneOf`, `invariant`.
- Hardening fixes from the review rounds (double-mount guard, hydrate ordering, ESLint Vue try/catch coverage, etc.).
- DX polish: `.editorconfig`, `.nvmrc`, `CLAUDE.md`, delete placeholder test, enable `exactOptionalPropertyTypes`.

**Out of scope**
- Business logic (agents, economy, simulation).
- New UI views or pages beyond wiring the existing Homepage.
- Vault-file log output target (future subscriber on the `log` channel).
- CI pipeline.

## 2. Architecture Overview

### 2.1 Shell/core split

```
┌──────────────────────────────────────────────┐
│  Obsidian Shell (src/main.ts)                │
│  Thin: creates adapters, passes to core,     │
│  calls init/destroy. ~40 lines.              │
├──────────────────────────────────────────────┤
│  Plugin Core (src/core/)                     │
│  Platform-agnostic. Owns startup sequence,   │
│  registries, lifecycle signals, error        │
│  handler, logger. Receives ALL deps as       │
│  ports. Never imports 'obsidian'.            │
├──────────┬───────────┬───────────────────────┤
│ Domain   │ Infra     │ UI                    │
│ Pure TS  │ Adapters  │ Vue 3 presentation    │
│ Ports    │ Obsidian  │ Stores unwrap Result  │
│ EventBus │ try/catch │ Publish errors on bus │
│ Result   │ Node      │ Components see state  │
└──────────┴───────────┴───────────────────────┘
```

`src/core/` is a new layer between the shell and the existing three layers. It is not infrastructure (no Obsidian) and not domain (it orchestrates, not models). It is the **composition + lifecycle engine**.

### 2.2 Dependency rules (updated)

All Increment 1 rules remain. New additions:

- **Core is platform-agnostic.** No import of `obsidian`, `node:*` (except `crypto.randomUUID` which is a web standard), or Vue/Pinia/Router. Core depends only on domain types/ports and its own modules.
- **Core may call `console.warn`/`console.error`/`console.debug`/`console.log`.** The Logger is the sanctioned console touchpoint; ESLint `no-console: 'off'` applies to `src/core/**`.
- **Stores publish errors on the EventBus** instead of calling `console.*` or importing `Notice`. No `console.*` in `src/ui/**`.

### 2.3 Port inventory

| Port | Location | Adapter | Purpose |
|------|----------|---------|---------|
| `SettingsPort` | `domain/settings/` | `ObsidianSettingsAdapter` | Load/save/subscribe settings |
| `ViewRegistryPort` | `domain/views/` | `ViewRegistry` | Register + open views |
| `CommandPort` | `domain/commands/` | `ObsidianCommandAdapter` | Register commands + ribbon hints |
| `LoggerPort` | `domain/shared/` | `Logger` (in core) | Structured logging |
| `NotificationPort` | `domain/shared/` | `ObsidianNotificationAdapter` | Show user-facing notices |
| `EventBus` | `domain/shared/` | *(domain-pure, no adapter)* | Typed pub/sub with channels |

### 2.4 Data flow — user clicks ribbon → view opens

1. User clicks ribbon icon.
2. `ObsidianCommandAdapter` fires the command callback.
3. Callback calls `viewPort.openView(plugin, viewType)`.
4. `bus.emit('command', { id, trigger: 'ribbon' })` for tracing.
5. `ViewRegistry` finds or creates the leaf, `HomepageView.onOpen()` mounts Vue.
6. Vue app hydrates stores; stores load settings via `SettingsPort`.
7. If any step fails: store emits `error:*` on bus → `ErrorHandler` logs + optionally shows Notice.

### 2.5 Data flow — error pipeline

```
Domain fn returns err(...)
  → Infrastructure adapter catches exception → returns err(...)
    → Store unwraps Result:
        isOk → update reactive state
        isErr → bus.emit('error', { severity, code, message, source })
          → ErrorHandler.handle():
              - logger.error(source, message)     // console.error + bus log event
              - if severity 'user'|'fatal' → notifications.show(message)
```

Components never see errors directly. They consume reactive state that is always valid, plus an optional `lastError` ref on the store for inline error display.

## 3. EventBus

### 3.1 EventMap (single source of truth)

```ts
type EventMap = {
  log:      { level: 'debug' | 'info' | 'error'; source: string; message: string; data?: unknown };
  error:    { code: string; message: string; source: string; severity: 'user' | 'system' | 'fatal'; data?: unknown };
  settings: { previous: PluginSettings; current: PluginSettings };
  core:     { phase: 'initializing' | 'ready' | 'destroying' | 'destroyed' };
  command:  { id: string; trigger: 'palette' | 'ribbon' | 'hotkey' };
};
```

### 3.2 EventEnvelope (tracing)

Every event is wrapped in an envelope at `emit()` time:

```ts
type EventEnvelope<K extends keyof EventMap> = {
  channel: K;
  payload: EventMap[K];
  traceId: string;      // groups a chain of related events
  eventId: string;      // unique per individual event
  parentId?: string;    // the eventId that caused this one
  timestamp: number;    // Date.now()
};
```

- `emit('settings', payload)` with no parent → new `traceId` + `eventId` (start of a new trace).
- `emit('settings', payload, { parentId: envelope.eventId })` → reuses the triggering event's `traceId`, records the parent→child link.
- `onAny()` receives full envelopes for centralized debug logging: `[traceId] channel → payload`.

### 3.3 API surface

```ts
interface EventBus {
  on<K extends keyof EventMap>(channel: K, listener: (envelope: EventEnvelope<K>) => void): Unsubscribe;
  emit<K extends keyof EventMap>(channel: K, payload: EventMap[K], opts?: { parentId?: string }): EventEnvelope<K>;
  onAny(listener: (envelope: EventEnvelope<keyof EventMap>) => void): Unsubscribe;
}
```

### 3.4 Design rules

- `EventMap` is the single source of truth — TypeScript enforces payload shape at every `emit` and `on` call site.
- Bus is synchronous. Listeners fire in registration order, same tick. Listeners that need async work dispatch to a queue; they do not block the bus.
- Bus is instantiated once in `PluginCore` and injected everywhere. No global singleton.
- `traceId` + `eventId` generated via `generateId()` (wraps `crypto.randomUUID()`).

### 3.5 Extending EventMap for new domains

```ts
// src/domain/agents/agent-events.ts
declare module '../shared/event-bus.js' {
  interface EventMap {
    agent: { id: string; action: 'spawned' | 'idle' | 'working' | 'died' };
  }
}
```

Module augmentation keeps each domain's events co-located. The bus implementation never changes — only the type.

## 4. PluginCore

### 4.1 CorePorts interface

```ts
interface CorePorts {
  settings: SettingsPort;
  commands: CommandPort;
  views: ViewRegistryPort;
  logger: LoggerPort;
  notifications: NotificationPort;
  eventBus: EventBus;
}
```

### 4.2 Lifecycle

```ts
class PluginCore {
  private state: 'idle' | 'initializing' | 'ready' | 'destroyed' = 'idle';

  constructor(private readonly ports: CorePorts) {}

  async init(): Promise<void> {
    this.state = 'initializing';
    this.ports.eventBus.emit('core', { phase: 'initializing' });

    // 1. Load settings
    const settings = await this.ports.settings.load();
    // 2. Configure logger level from settings
    // 3. Register commands (from declarative entries)
    // 4. Register views
    // 5. Subscribe to settings changes

    this.state = 'ready';
    this.ports.eventBus.emit('core', { phase: 'ready' });
  }

  destroy(): void {
    this.ports.eventBus.emit('core', { phase: 'destroying' });
    // tear down subscriptions, unregister commands
    this.state = 'destroyed';
    this.ports.eventBus.emit('core', { phase: 'destroyed' });
  }

  get ready(): boolean { return this.state === 'ready'; }
}
```

### 4.3 Obsidian shell (`src/main.ts`) — ~40 lines

```ts
export default class AgentonomousPlugin extends Plugin {
  private core: PluginCore | null = null;

  async onload(): Promise<void> {
    const bus = new EventBus();
    const settings = new ObsidianSettingsAdapter(this);
    const commands = new ObsidianCommandAdapter(this);
    const views = new ViewRegistry([...VIEW_ENTRIES]);
    const logger = new Logger(bus, 'info');
    const notifications = new ObsidianNotificationAdapter();
    const errorHandler = new ErrorHandler(bus, logger, notifications);

    this.core = new PluginCore({ settings, commands, views, logger, notifications, eventBus: bus });
    await this.core.init();

    views.registerAll(this, this.core.context);
    this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings));
    this.register(() => this.core?.destroy());
  }
}
```

`onunload` body is empty — `this.register(...)` handles destroy automatically.

### 4.4 Headless mode

```ts
const bus = new EventBus();
const core = new PluginCore({
  settings: fakeSettings,
  commands: fakeCommands,
  views: fakeViews,
  logger: new Logger(bus, 'debug'),
  notifications: fakeNotifications,
  eventBus: bus,
});
await core.init();
// assert bus received core:ready
core.destroy();
// assert bus received core:destroyed
```

No Obsidian, no DOM, no Vue. Pure lifecycle + bus integration test.

## 5. CommandRegistry (command-centric)

### 5.1 CommandEntry shape

```ts
type CommandEntry = {
  readonly id: string;
  readonly name: string;
  readonly callback?: () => void | Promise<void>;
  readonly ribbon?: {
    readonly icon: string;
    readonly title: string;
    readonly visibleByDefault: boolean;
  };
  readonly opensView?: string;
};
```

- If `opensView` is set, the registry auto-generates the callback to open that view via `ViewRegistryPort`. If both `callback` and `opensView` are provided, `opensView` takes precedence (logger warning emitted).
- `ribbon` is optional metadata. `showRibbonIcon` in settings gates ALL ribbon items globally.

### 5.2 CommandPort

```ts
interface CommandPort {
  register(entry: CommandEntry): Unsubscribe;
  unregisterAll(): void;
}
```

`ObsidianCommandAdapter` implements this by calling `plugin.addCommand(...)` + optionally `plugin.addRibbonIcon(...)`.

### 5.3 Settings-driven ribbon toggling

`PluginCore.init()` subscribes to `settings:changed` on the bus. When `showRibbonIcon` changes, it calls `commandPort.unregisterAll()` and re-registers with updated visibility. This replaces the manual remove/re-add dance in the current `main.ts`.

### 5.4 What this replaces

- `src/infrastructure/ribbon/ribbon.ts` — **deleted**. Responsibility moves into `ObsidianCommandAdapter`.
- The ad-hoc `addCommand` + `addRibbonIcon` + `settings.subscribe` block in current `main.ts` — replaced by declarative entries + `PluginCore.init()`.

### 5.5 Skeleton command entries

```ts
const CORE_COMMANDS: readonly CommandEntry[] = [
  {
    id: 'open-homepage',
    name: 'Open homepage',
    opensView: VIEW_TYPE_HOMEPAGE,
    ribbon: { icon: 'bot', title: 'Open Agentonomous', visibleByDefault: true },
  },
];
```

### 5.6 Adding future commands

```ts
// src/domain/agents/agent-commands.ts
export const AGENT_COMMANDS: readonly CommandEntry[] = [
  {
    id: 'open-inspector',
    name: 'Open agent inspector',
    opensView: 'agentonomous-inspector',
    ribbon: { icon: 'search', title: 'Agent inspector', visibleByDefault: false },
  },
];
```

Integration: `[...CORE_COMMANDS, ...AGENT_COMMANDS]` passed to PluginCore. One-line addition.

## 6. Logger + ErrorHandler + NotificationPort

### 6.1 LoggerPort (domain-pure)

```ts
type LogLevel = 'debug' | 'info' | 'error';

interface LoggerPort {
  debug(source: string, message: string, data?: unknown): void;
  info(source: string, message: string, data?: unknown): void;
  error(source: string, message: string, data?: unknown): void;
  setLevel(level: LogLevel): void;
}
```

### 6.2 Logger implementation (lives in `src/core/logger.ts`)

Dual output: console + EventBus.

```ts
class Logger implements LoggerPort {
  constructor(private bus: EventBus, private level: LogLevel) {}

  debug(source, message, data?) {
    if (this.shouldLog('debug')) {
      console.debug(`[agentonomous:${source}]`, message, data);
      this.bus.emit('log', { level: 'debug', source, message, data });
    }
  }

  info(source, message, data?) {
    if (this.shouldLog('info')) {
      console.log(`[agentonomous:${source}]`, message, data);
      this.bus.emit('log', { level: 'info', source, message, data });
    }
  }

  error(source, message, data?) {
    // errors always fire regardless of level
    console.error(`[agentonomous:${source}]`, message, data);
    this.bus.emit('log', { level: 'error', source, message, data });
  }
}
```

- `console.error` always fires regardless of log level.
- `console.debug`/`console.log` gated by settings-configurable log level (default `'info'`).
- Bus emission alongside console — structured subscribers get the typed event; devs get the human-readable console line.
- Logger lives in `src/core/` (not domain) since it calls `console.*` directly.
- The `LoggerPort` interface stays domain-pure — consumers only see the method signatures.
- No separate `ObsidianLoggerAdapter` needed — the Logger IS the output. Infrastructure's only logging adapter is `ObsidianNotificationAdapter` (for `Notice`).

### 6.3 NotificationPort (domain-pure)

```ts
interface NotificationPort {
  show(message: string): void;
}
```

`ObsidianNotificationAdapter` wraps `new Notice(message)`. One class, one method.

### 6.4 ErrorHandler (`src/core/error-handler.ts`)

```ts
class ErrorHandler {
  constructor(
    private bus: EventBus,
    private logger: LoggerPort,
    private notifications: NotificationPort,
  ) {
    bus.on('error', (envelope) => this.handle(envelope));
  }

  private handle(envelope: EventEnvelope<'error'>): void {
    const { severity, message, source, code } = envelope.payload;

    this.logger.error(source, `[${code}] ${message}`);

    if (severity === 'user' || severity === 'fatal') {
      this.notifications.show(message);
    }
  }
}
```

### 6.5 Settings extension

`PluginSettings` gains:

```ts
type PluginSettings = {
  readonly showRibbonIcon: boolean;
  readonly defaultView: DefaultViewName;
  readonly logLevel: LogLevel;         // new — default 'info'
};
```

Settings tab gains a "Log level" dropdown (`debug` / `info` / `error`). When changed, `PluginCore` calls `logger.setLevel(newSettings.logLevel)`.

### 6.6 How stores use the error pipeline

```ts
// in useSettingsStore
async function update(next: PluginSettings): Promise<void> {
  invariant(port !== null, 'settings store not hydrated');
  const r = await port.save(next);
  if (isOk(r)) {
    settings.value = next;
  } else {
    bus.emit('error', {
      code: 'SETTINGS_SAVE_FAILED',
      message: r.error,
      source: 'settings-store',
      severity: 'user',
    });
  }
}
```

No `console.*` in stores. No `Notice` imports. Just typed error events. The ErrorHandler decides output.

### 6.7 ESLint adjustment

`src/core/**` gets `no-console: 'off'` override (Logger is the sanctioned console touchpoint).

## 7. Shared Utilities

### 7.1 Files

```
src/domain/shared/utils/
├── identity.ts       # generateId(), timestamp()
├── is-one-of.ts      # isOneOf<T>(value, allowed): value is T
└── invariant.ts       # invariant(condition, msg): asserts condition
```

### 7.2 Specifications

**`generateId(): string`** — wraps `crypto.randomUUID()`. Single point to swap if environment doesn't support it.

**`timestamp(): number`** — wraps `Date.now()`. Injectable for deterministic test replay of event traces.

**`isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T`** — generic enum-membership guard. Replaces the `KNOWN_DEFAULT_VIEWS.includes(x as DefaultViewName)` cast pattern. One-liner consumers: `export const isDefaultViewName = (v: string): v is DefaultViewName => isOneOf(v, KNOWN_DEFAULT_VIEWS);`

**`invariant(condition: boolean, message: string): asserts condition`** — runtime assertion for "this should never happen" guards. Replaces bare `throw new Error(...)` with intent-communicating semantics. Throws `Error` in all environments (no prod-stripping for now; revisit when performance matters).

### 7.3 Rules

- Every utility is a named export, pure function, zero deps outside `utils/`.
- Each file <50 lines.
- No wrappers for native operations that are already obvious (no `isString`, `isObject`, `isBoolean`).

### 7.4 Refactoring existing code

- `plugin-settings.ts`: `isDefaultViewName` becomes a one-liner using `isOneOf`. Private `isObject` stays inline.
- `settings-store.ts`: `throw new Error('not hydrated')` → `invariant(port !== null, 'settings store not hydrated')`.
- `settings-tab.ts`: imports `isDefaultViewName` from domain (already the case).
- EventBus: uses `generateId()` for `traceId`/`eventId`, `timestamp()` for envelope timestamps.

## 8. Hardening Fixes

### 8.1 Double-mount guard in `HomepageView.onOpen`

Synchronous `mounting` sentinel set before the `await`:

```ts
private mounting = false;

async onOpen(): Promise<void> {
  if (this.mounted !== null || this.mounting) return;
  this.mounting = true;
  try { /* create Vue app */ }
  finally { this.mounting = false; }
}
```

### 8.2 Hydrate subscribe-after-load ordering

```ts
async function hydrate(newPort: SettingsPort): Promise<void> {
  port = newPort;
  unsub?.();
  const loaded = await port.load();
  if (isOk(loaded)) settings.value = loaded.value;
  unsub = port.subscribe((s) => { settings.value = s; });
}
```

Subscribe fires only AFTER initial state is set.

### 8.3 ESLint Vue try/catch coverage

Add `'no-restricted-syntax': noTryCatchOutsideInfra` to the `**/*.vue` ESLint block.

### 8.4 Storybook `test.include` deprecation

Remove explicit `include` from the storybook vitest project. Let `storybookTest()` handle discovery.

### 8.5 DX polish

| Item | Action |
|------|--------|
| `.editorconfig` | Add: `indent_style = tab`, `end_of_line = lf`, `charset = utf-8` |
| `.nvmrc` | Add: `20.19` |
| `CLAUDE.md` inside Agentonomous | Add with layer rules, scripts, env vars, port inventory |
| Vault-root `CLAUDE.md` | Add Agentonomous row to project table |
| `placeholder.test.ts` | Delete |
| `exactOptionalPropertyTypes` | Enable in `tsconfig.json` |
| `PluginContextKey` dead provide | Wire consumer in `About.vue` to prove the injection pattern |

## 9. File Inventory (new + modified)

### 9.1 New files

```
src/core/
├── plugin-core.ts              # PluginCore class with init/destroy lifecycle
├── logger.ts                   # Logger implementing LoggerPort (console + bus)
├── error-handler.ts            # ErrorHandler subscribing to error:* channel
└── command-registry.ts         # CommandEntry resolution (opensView → callback)

src/domain/shared/
├── event-bus.ts                # EventBus + EventMap + EventEnvelope (tracing)
├── logger-port.ts              # LoggerPort interface + LogLevel type
├── notification-port.ts        # NotificationPort interface
└── utils/
    ├── identity.ts             # generateId(), timestamp()
    ├── is-one-of.ts            # isOneOf<T>()
    └── invariant.ts            # invariant()

src/domain/commands/
├── command-types.ts            # CommandEntry type
├── command-port.ts             # CommandPort interface
└── core-commands.ts            # CORE_COMMANDS array (open-homepage)

src/infrastructure/obsidian/
├── obsidian-command-adapter.ts  # implements CommandPort
└── obsidian-notification-adapter.ts  # implements NotificationPort
```

### 9.2 Modified files

```
src/main.ts                      # Shrinks to ~40 lines (thin shell)
src/plugin.ts                    # PluginContext gains logger, notifications, eventBus
src/ui/stores/settings-store.ts  # Hydrate reorder + error → bus.emit
src/ui/pages/About.vue           # Inject PluginContextKey (prove the pattern)
src/ui/app.ts                    # Remove .catch(console.error), stores handle errors
src/infrastructure/views/homepage-view.ts  # Add mounting sentinel
src/domain/settings/plugin-settings.ts     # Add logLevel field, refactor with isOneOf
configs/eslint.config.mjs        # Add core override, Vue try/catch rule
configs/tsconfig.json            # Enable exactOptionalPropertyTypes
configs/vitest.config.ts         # Remove storybook test.include
```

### 9.3 Deleted files

```
src/infrastructure/ribbon/ribbon.ts  # Responsibility moved to ObsidianCommandAdapter
tests/placeholder.test.ts            # Noise
```

## 10. Acceptance Criteria

### 10.1 Functional

1. Existing behavior preserved: ribbon icon, command palette, Homepage with routing, settings tab — all still work.
2. Settings tab gains "Log level" dropdown (debug/info/error). Changing it immediately affects console output verbosity.
3. `core:ready` event emitted on bus after `init()`. Verifiable in Obsidian console: `[agentonomous:core] ready` log line.
4. Errors surface as Notices for `severity: 'user'|'fatal'` AND as `console.error` always.
5. Settings save failure → Notice + console.error (no silent swallow).

### 10.2 Headless test

6. A test constructs `PluginCore` with fake ports (no Obsidian, no DOM, no Vue), calls `init()`, verifies `core:ready` on bus, exercises a command entry, verifies `command:*` event on bus, calls `destroy()`, verifies `core:destroyed` on bus.

### 10.3 Quality gates

7. `npm test` green (lint + typecheck + vitest). Test count grows to ~80+ (new EventBus, Logger, ErrorHandler, CommandRegistry, PluginCore, utility tests).
8. Coverage thresholds still met (80/70/80/80).
9. ESLint enforces: no try/catch in Vue SFCs, no console in `src/ui/`, `src/core/` allowed console.

### 10.4 Architectural invariants

10. `src/core/` imports only from `src/domain/` — never from `obsidian`, `vue`, `pinia`, `src/infrastructure/`, `src/ui/`.
11. `src/main.ts` is ≤50 lines.
12. No `console.*` calls in `src/ui/**` or `src/domain/**`.
13. All error paths end at the bus — no `Notice` imports outside `src/infrastructure/`, no `console.error` outside `src/core/` and `src/infrastructure/`.

## 11. Risks

- **`crypto.randomUUID()` availability** — available in Node 19+ and modern browsers. Obsidian desktop runs Electron (Chromium-based), so it's safe. If a future mobile target lacks it, `generateId()` is the single swap point.
- **EventMap module augmentation** — TypeScript's `declare module` must point to the exact module specifier (`.js` suffix in NodeNext). If the import path drifts, augmentations silently stop merging. Tests should verify channel registration for each domain's events.
- **Logger dual-output performance** — `console.*` + `bus.emit()` on every log call. For `debug` level with high-frequency agent simulation events, this could be noisy. Mitigated by log-level gating (default `'info'`).

## 12. Next Step

After this spec is approved, the `writing-plans` skill produces a detailed implementation plan.
