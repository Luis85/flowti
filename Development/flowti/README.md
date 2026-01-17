# Flowti - The Business Development Environment

## Introducing the Flowti Business Framework

This is a preconfigured Obsidian Vault, ready to go as documentation system called „FLOWTI - IBDE“ an integrated business development environment and management system.
Goal of this framework is to provide all necessary utilities to describe and visualize digital twins of things and business processes.

This document describes how to get the current implementation up and running.
To get the most out of our documentation we use Obsidian and Git.
To start your journey you will need to have Obsidian installed which serves as a host for the application.

## Why tho?

Curiosity

## About me

- studying economy since 2010
- various roles as consultant in IT and Product
- my 3 biggest hobbies are gaming, design, and coding

## Prerequisites

Before we get started, make sure the following things are in place:

- [Git](https://git-scm.com) is installed
- [Obsidian](https://obsidian.md) is installed

## Tutorial - How to get in

### Step 1 - Clone the repo

- Open a Terminal
- `cd C:\Projects`
- `git clone $repo_url`

### Step 2 - Open the vault

- Open Obsidian
- Click on `Open Folder as Vault`
- Navigate to `C:\Projects\`
- Select `Vault`
- Click `Open as Folder`

---

## Plugin Architecture

Flowti is built as an Obsidian plugin with a clean, event-driven architecture designed for extensibility and testability.

### Core Principles

- **Event-Driven Architecture**: Components communicate through a central EventBus, enabling loose coupling
- **Dependency Injection**: Services receive dependencies via constructor options for easy testing
- **XState Compatibility**: Events follow the xstate v5 convention `{ type, payload, timestamp }` for future state machine integration
- **Type Safety**: Full TypeScript with Zod validation and branded types

### Project Structure

```
src/
├── main.ts                 # Plugin entry point, lifecycle management
├── events/
│   ├── events.ts           # Central event definitions (FlowtiEventMap)
│   ├── types.ts            # Event types and IEventBus interface
│   └── EventBus.ts         # Pub/Sub implementation
├── logger/
│   ├── types.ts            # ILogger interface, LogLevel, LogEntry
│   └── LoggerService.ts    # Logging with event emission
├── settings/
│   ├── settings.ts         # Zod schema, types, defaults
│   └── FlowtiSettingTab.ts # Settings UI
├── user/
│   ├── types.ts            # FlowtiUser, IUserService, Zod schemas
│   ├── UserService.ts      # User management with event emission
│   └── UserSetupModal.ts   # First-run user setup
└── utils/
    ├── types.ts            # Shared types (UUID, IStorageProvider)
    └── helpers.ts          # Utility functions (generateUUID)

tests/
├── events/EventBus.test.ts
├── logger/LoggerService.test.ts
├── settings/settings.test.ts
├── user/UserService.test.ts
└── utils/helpers.test.ts
```

### Event System

The EventBus is the backbone of the application, enabling decoupled communication between components.

```typescript
// Available events (src/events/events.ts)
interface FlowtiEventMap {
  "user.created": { user: FlowtiUser };
  "user.updated": { user: FlowtiUser };
  "settings.changed": { settings: FlowtiSettings };
  "log.entry": LogEntry;
  "log.error": LogEntry;
}

// Usage examples
eventBus.on("user.created", (event) => {
  console.log(`Welcome, ${event.payload.user.name}!`);
});

eventBus.on("*", (event) => {
  // Wildcard listener for debugging/logging
  console.log(`[${event.timestamp}] ${event.type}`);
});

eventBus.once("user.created", handler); // One-time listener
```

### Initialization Flow

```
Plugin.onload()
    │
    ├── loadSettings()         # Load and validate settings with Zod
    ├── initializeEventBus()   # Create EventBus instance
    ├── initializeLogger()     # Create Logger with EventBus
    ├── setupEventListeners()  # Wire cross-cutting concerns
    │       └── settings.changed → logger.setDebugMode()
    ├── initializeUserService() # Create UserService with EventBus
    │       └── userService.load()
    ├── addSettingTab()
    └── onLayoutReady()
            └── UserSetupModal.showIfNeeded()
```

### Services

**UserService**
- Manages user data (name, ID, createdAt)
- Emits `user.created` and `user.updated` events
- Persists to Obsidian's plugin data storage

**LoggerService**
- Four log levels: debug, info, warn, error
- Debug logs controlled by `settings.debugMode`
- Emits `log.entry` and `log.error` events
- Supports context prefixes: `logger.setContext("UserService")`

### Adding New Features

1. **Define events** in `src/events/events.ts`:
   ```typescript
   export interface FlowtiEventMap {
     "task.created": { task: Task };
     "task.completed": { taskId: string };
   }
   ```

2. **Create service** with EventBus injection:
   ```typescript
   export class TaskService {
     constructor(options: { storage: IStorageProvider; eventBus?: IEventBus }) {
       // ...
     }

     async createTask(title: string) {
       const task = { /* ... */ };
       await this.eventBus?.emit("task.created", { task });
       return task;
     }
   }
   ```

3. **Wire in main.ts**:
   ```typescript
   private async initializeTaskService() {
     this.taskService = new TaskService({
       storage: { load: () => this.loadData(), save: (d) => this.saveData(d) },
       eventBus: this.eventBus,
     });
   }
   ```

## Development

### Setup

```bash
cd Development/flowti
npm install
```

### Commands

```bash
npm test           # Run tests
npm run test:watch # Watch mode
npm run check      # TypeScript + ESLint
npm run build      # Full build (tests → typedoc → check → esbuild)
npm run docs       # Generate TypeDoc documentation
```

### Test Coverage

- **47 tests** across 5 test suites
- EventBus: 13 tests (on/off, emit, wildcard, once, clear)
- LoggerService: 13 tests (levels, context, events, debugMode)
- UserService: 15 tests (CRUD, validation, events)
- Settings: 4 tests (Zod validation)
- Helpers: 2 tests (UUID generation)

