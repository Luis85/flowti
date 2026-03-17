---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - command.registered
  - command.executed
  - command.removed
maturity: L4
business_value: 4
implementation_cost: 2
maintenance_cost: 1
discovery_cost: 1
design_cost: 1
test_cost: 2
priority: 0
---

# Feature: Command Bus

---

## 1. Problem Statement

Obsidian plugins need a structured way to register, discover, and execute user-facing commands without tightly coupling UI code to business logic. Without a command bus, every new command requires manual wiring between the Obsidian command palette, ribbon icons, and the underlying service calls.

- **Who is affected?** Plugin developers and the plugin orchestrator (`main.ts`).
- **What breaks?** Adding a new user action requires changes in multiple files — command registration, event wiring, and UI hookup.
- **Why it matters:** A centralized command bus reduces the cost of adding new features and ensures consistent command lifecycle management.

---

## 2. Outcome

- **User can** invoke any registered command from the Obsidian command palette, ribbon, or programmatically.
- **System can** register, execute, and unregister commands through a single `CommandRegistry` with type-safe command descriptors.
- **Domain gains** a decoupled command execution layer that routes user intent to the appropriate service via the EventBus.

---

## 3. Scope

### In Scope

- CommandRegistry for registering and managing command descriptors
- UiCommandService for bridging commands to Obsidian's command palette and ribbon
- Type-safe command descriptors with `id`, `name`, `icon`, `callback`
- Integration with EventBus for command execution events
- Batch registration during plugin bootstrap

### Out of Scope

- Command undo/redo
- Command queuing or scheduling
- User-defined custom commands via UI
- Command access control or permissions

---

## 4. UX Entry Points

- **Obsidian command palette**: All registered commands appear as `Flowti: <name>`
- **Ribbon icons**: Selected commands exposed as ribbon buttons
- **Programmatic**: Services can execute commands via `CommandRegistry.execute(id)`

---

## 5. Functional Requirements

- [x] CommandRegistry accepts command descriptors with `id`, `name`, `icon`, `callback`
- [x] UiCommandService registers commands with Obsidian's `addCommand()` API
- [x] Commands are unregistered on plugin unload
- [x] Command execution emits events on the EventBus
- [x] Ribbon icons are created for commands with `showInRibbon: true`
- [x] Error handling wraps command callbacks to prevent unhandled rejections

---

## 6. Data Model Impact

Entities:

```
CommandDescriptor
  id: string          (e.g., "flowti:import-csv")
  name: string        (display name in command palette)
  icon?: string       (Lucide icon name)
  callback: () => void | Promise<void>
  showInRibbon?: boolean
```

No persistent storage — commands are registered in memory at plugin startup.

---

## 7. Event Impact

### Produced

- `command.registered` — payload: `{ commandId }`
- `command.executed` — payload: `{ commandId }`
- `command.removed` — payload: `{ commandId }`

### Consumed

- None (commands are the initiators, not consumers)

---

## 8. UI Layout Impact

- No new views or tabs
- Commands appear in Obsidian's native command palette
- Ribbon icons added for select commands

---

## 9. Adapter Impact

```
CommandRegistry
├── register(descriptor: CommandDescriptor): void
├── execute(id: string): Promise<void>
├── unregister(id: string): void
├── getAll(): CommandDescriptor[]
└── dispose(): void

UiCommandService
├── registerAll(descriptors: CommandDescriptor[]): void
├── addRibbonIcon(descriptor: CommandDescriptor): void
└── dispose(): void
```

---

## 10. Non-Functional Requirements

- **Startup**: All commands registered during `onload()` — no lazy registration
- **Memory**: All listeners and ribbon icons cleaned up on `onunload()`
- **Error isolation**: A failing command callback must not crash the plugin

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Command ID collisions | Namespace all IDs with `flowti:` prefix |
| Stale ribbon icons after hot reload | Full cleanup in `dispose()` |

---

## 12. Acceptance Criteria

- [x] Commands appear in Obsidian command palette after plugin load
- [x] Executing a command triggers the associated callback
- [x] Commands are removed from the palette on plugin unload
- [x] Ribbon icons appear for flagged commands
- [x] Command execution errors are caught and logged

---

## 13. Definition of Done

- [x] `CommandRegistry` implemented with register/execute/unregister
- [x] `UiCommandService` bridges to Obsidian command API
- [x] Integration with EventBus for command lifecycle events
- [x] Unit tests cover registration, execution, and error handling
- [x] `npm run build` passes
