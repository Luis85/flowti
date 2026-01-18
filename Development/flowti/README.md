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
- **Registry Pattern**: Commands, Views, and Services are registered through dedicated registries
- **Dependency Injection**: Services receive dependencies via ServiceContainer for lifecycle management
- **XState Compatibility**: Events follow the xstate v5 convention `{ type, payload, timestamp }` for future state machine integration
- **Type Safety**: Full TypeScript with Zod validation and typed errors

### Project Structure

```
src/
├── main.ts                    # Plugin entry point, lifecycle management
├── commands/
│   ├── CommandRegistry.ts     # Command execution with middleware
│   ├── registry.ts            # Command definitions
│   └── types.ts               # ICommandRegistry, CommandDefinition
├── errors/
│   ├── ErrorService.ts        # Centralized error handling
│   ├── FlowtiError.ts         # Error class hierarchy
│   └── types.ts               # IErrorService, FlowtiErrorInfo
├── events/
│   ├── EventBus.ts            # Pub/Sub implementation
│   ├── events.ts              # Central event definitions (FlowtiEventMap)
│   └── types.ts               # IEventBus, EventHandler types
├── logger/
│   ├── LoggerService.ts       # Logging with event emission
│   └── types.ts               # ILogger, LogLevel, LogEntry
├── services/
│   ├── ServiceContainer.ts    # DI container with lifecycle
│   ├── registry.ts            # Service registrations
│   └── types.ts               # IServiceContainer, ServiceDefinition
├── settings/
│   ├── settings.ts            # Zod schema, types, defaults
│   ├── SettingsService.ts     # Settings management service
│   ├── FlowtiSettingTab.ts    # Settings UI
│   └── types.ts               # ISettingsService
├── user/
│   ├── types.ts               # FlowtiUser, IUserService, Zod schemas
│   ├── UserService.ts         # User management with events
│   └── UserSetupModal.ts      # First-run user setup
├── views/
│   ├── ViewRegistry.ts        # View registration
│   ├── registry.ts            # View definitions
│   ├── types.ts               # IViewRegistry, ViewDefinition
│   └── ComponentShowcaseView.ts # CSS component showcase
├── styles/
│   └── main.css               # Custom CSS utilities (ft-* prefix)
└── utils/
    ├── types.ts               # Shared types (UUID, IStorageProvider)
    └── helpers.ts             # Utility functions

tests/
├── commands/CommandRegistry.test.ts
├── errors/ErrorService.test.ts
├── errors/FlowtiError.test.ts
├── events/EventBus.test.ts
├── logger/LoggerService.test.ts
├── services/ServiceContainer.test.ts
├── settings/settings.test.ts
├── settings/SettingsService.test.ts
├── user/UserService.test.ts
└── utils/helpers.test.ts
```

### Event System

The EventBus is the backbone of the application, enabling decoupled communication between components.

```typescript
// Available events (src/events/events.ts)
interface FlowtiEventMap {
  // Plugin lifecycle
  "plugin.loading": { timestamp: string };
  "plugin.loaded": { timestamp: string };
  "plugin.ready": { timestamp: string };

  // Services
  "service.registered": { serviceId: string };
  "service.initialized": { serviceId: string };

  // Commands & Views
  "command.registered": { commandId: string; commandName: string };
  "command.executed": { commandId: string; durationMs: number };
  "view.registered": { type: string; displayName: string };

  // User & Settings
  "user.created": { user: FlowtiUser };
  "user.updated": { user: FlowtiUser };
  "settings.changed": { settings: FlowtiSettings };

  // Errors
  "error.occurred": FlowtiErrorInfo;
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
    ├── Phase 1: Core Infrastructure
    │   ├── loadSettings()
    │   ├── initializeEventBus()
    │   ├── initializeLogger()
    │   ├── initializeErrorService()
    │   └── setupEventListeners()
    │
    ├── Phase 2: Containers
    │   ├── initializeServiceContainer()
    │   ├── initializeCommandRegistry()
    │   └── initializeViewRegistry()
    │
    ├── Phase 3: Registration
    │   ├── registerAllServices()
    │   ├── registerAllCommands()
    │   └── registerAllViews()
    │
    ├── Phase 4: Initialization
    │   └── services.initializeAll()
    │
    ├── Phase 5: UI Setup
    │   ├── addSettingTab()
    │   ├── bindViews()
    │   └── bindCommands()
    │
    └── Phase 6: Post-load
        └── onLayoutReady()
            └── UserSetupModal.showIfNeeded()
```

### Core Services

**ServiceContainer**
- Dependency injection with lifecycle management
- Automatic dependency resolution
- Initialize/dispose hooks for services

**CommandRegistry**
- Middleware support (logging, error handling)
- Type-safe command context (app, eventBus, logger)
- Automatic binding to Obsidian's command system

**ViewRegistry**
- Centralized view registration
- Factory pattern for view creation
- Automatic binding to Obsidian's view system

**ErrorService**
- Centralized error handling
- Typed error hierarchy (ValidationError, LifecycleError, etc.)
- Error event emission for monitoring

**UserService**
- User data management (name, ID, createdAt)
- Emits `user.created` and `user.updated` events
- ValidationError for invalid inputs

**SettingsService**
- Settings management with Zod validation
- Event emission on settings changes

### CSS Utilities

Custom CSS utilities with `ft-` prefix to avoid Obsidian conflicts:

```css
/* Components */
.ft-btn, .ft-btn-primary, .ft-btn-secondary, .ft-btn-ghost
.ft-card, .ft-input, .ft-label, .ft-badge, .ft-alert-*

/* Layout */
.ft-flex, .ft-flex-col, .ft-gap-*, .ft-items-center, .ft-justify-between

/* Spacing */
.ft-p-*, .ft-m-*, .ft-mt-*, .ft-mb-*

/* Typography */
.ft-heading, .ft-text-muted, .ft-text-sm, .ft-font-bold
```

Use the Component Showcase view (Command: "Open Component Showcase") to preview all available components.

### Adding New Features

1. **Add Commands** in `src/commands/registry.ts`:
   ```typescript
   {
     id: "flowti:my-command",
     name: "My Command",
     icon: "icon-name",
     handler: async (ctx) => {
       ctx.logger.debug("Executing");
       // Use ctx.app, ctx.eventBus, ctx.logger
     },
   }
   ```

2. **Add Views** in `src/views/registry.ts`:
   ```typescript
   {
     type: "flowti-my-view",
     displayName: "My View",
     icon: "icon-name",
     factory: (leaf) => new MyView(leaf),
   }
   ```

3. **Add Services** in `src/services/registry.ts`:
   ```typescript
   container.register({
     id: "myService",
     factory: async ({ eventBus, logger }) => {
       return new MyService({ eventBus, logger });
     },
     dependencies: [],
   });
   ```

4. **Add Events** in `src/events/events.ts`:
   ```typescript
   "task.created": { task: Task };
   "task.completed": { taskId: string };
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


