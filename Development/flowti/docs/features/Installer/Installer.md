---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
---

# Installer

The Installer is the first-run setup wizard for Flowti IBDE. It creates the user profile, scaffolds the PARA-based folder structure, and is designed to be extended with custom steps.

## Architecture

```
src/domain/installer/
├── types.ts                 # Interfaces: IInstallerStep, InstallerContext, etc.
├── events.ts                # InstallerEventMap (6 events)
├── folders.ts               # DEFAULT_IBDE_FOLDERS constant
├── InstallerService.ts      # Step registry + pipeline executor
├── InstallerWizardModal.ts  # 4-page Obsidian Modal
└── steps/
    ├── UserCreationStep.ts  # order 10 — creates user profile
    └── FolderScaffoldStep.ts # order 20 — scaffolds folders
```

### How It Works

1. On plugin load, `InstallerService.load()` reads persisted state from storage.
2. `InstallerWizardModal.showIfNeeded()` checks `isInstalled()` — if `false`, the wizard opens.
3. The wizard collects the user name (Welcome page), shows a preview (Review page), then runs the pipeline (Progress page).
4. `InstallerService.runAll(context)` executes all registered steps sequentially, sorted by `order`.
5. Each step receives a shared `InstallerContext` and `InstallerStepDeps` (fileSystem, eventBus, userService).
6. On success the state is persisted — the wizard won't show again on next load.

### Built-in Steps

| Step | Order | What it does |
|------|-------|-------------|
| `UserCreationStep` | 10 | Creates the user profile via `userService.createUser()`. Skips if user already exists. |
| `FolderScaffoldStep` | 20 | Creates all folders from `DEFAULT_IBDE_FOLDERS` using `.gitkeep` placeholders. Skips existing folders. |

Both steps are **idempotent** — safe to run multiple times.

---

## Creating a Custom Step

Implement `IInstallerStep`:

```typescript
import type {
  IInstallerStep,
  InstallerContext,
  InstallerStepDeps,
  InstallerStepResult,
} from "../types";

export class TemplateDeployStep implements IInstallerStep {
  readonly id = "template-deploy";
  readonly name = "Deploy Templates";
  readonly description = "Copies starter templates into the vault";
  readonly intro =
    "Starter templates give you pre-built note layouts for daily notes, " +
    "meeting minutes, and project briefs so you can hit the ground running.";
  readonly order = 30; // runs after UserCreation (10) and FolderScaffold (20)

  async execute(
    context: InstallerContext,
    deps: InstallerStepDeps,
  ): Promise<InstallerStepResult> {
    const templates = [
      "03 - Resources/Templates/Daily Note.md",
      "03 - Resources/Templates/Meeting.md",
    ];

    for (const tpl of templates) {
      try {
        await deps.fileSystem.createFile(tpl, "# {{title}}", {
          createFolders: true,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("already exists")) {
          continue; // idempotent
        }
        return {
          status: "failed",
          message: `Failed to deploy template: ${tpl}`,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }

    // Store result in context for downstream steps
    context.deployedTemplates = templates;

    return {
      status: "completed",
      message: `Deployed ${templates.length} templates`,
    };
  }
}
```

### Step Interface Reference

```typescript
interface IInstallerStep {
  readonly id: string;          // unique identifier
  readonly name: string;        // shown in the wizard UI
  readonly description: string; // shown in the review screen
  readonly intro: string;       // onboarding explanation (review page card)
  readonly order: number;       // lower = runs first
  execute(context: InstallerContext, deps: InstallerStepDeps): Promise<InstallerStepResult>;
}
```

### Return Values

| Status | Meaning |
|--------|---------|
| `"completed"` | Step ran successfully |
| `"skipped"` | Step determined no work was needed (idempotent) |
| `"failed"` | Step encountered an error — pipeline halts |

---

## Registering a Custom Step

Steps are registered in `infrastructure/services/registry.ts` inside the `installerService` factory:

```typescript
// in registry.ts → installerService factory
{
  id: "installerService",
  dependencies: ["userService"],
  factory: async (container: IServiceContainer) => {
    const userService = await container.get<IUserService>("userService");
    const eventBus = container.getEventBus();
    const fileSystem = new FileSystemClient({ eventBus });
    const service = new InstallerService({
      storage,
      eventBus,
      fileSystem,
      userService,
    });

    // Built-in steps
    service.registerStep(new UserCreationStep());
    service.registerStep(new FolderScaffoldStep());

    // Your custom step
    service.registerStep(new TemplateDeployStep());

    return service;
  },
}
```

Steps are sorted by `order` at runtime, so registration order doesn't matter.

> Registering two steps with the same `id` throws a `ValidationError`.

---

## Listening to Installer Events

The installer emits events on the EventBus. Subscribe to track progress:

```typescript
// Available events
eventBus.on("installer.started",        (e) => { /* e.payload.stepCount */ });
eventBus.on("installer.step.started",   (e) => { /* e.payload.stepId, stepName */ });
eventBus.on("installer.step.completed", (e) => { /* e.payload.id, name, status, message */ });
eventBus.on("installer.completed",      (e) => { /* e.payload.state */ });
eventBus.on("installer.failed",         (e) => { /* e.payload.failedStepId, error */ });
eventBus.on("installer.loaded",         (e) => { /* e.payload.state */ });
```

Example — log every step result:

```typescript
eventBus.on("installer.step.completed", (event) => {
  const { id, status, message } = event.payload;
  console.log(`Step ${id}: ${status} — ${message}`);
});
```

---

## Shared Context

Steps communicate through `InstallerContext`, a mutable object passed to every step:

```typescript
interface InstallerContext {
  userName?: string;        // set by the wizard (Welcome page)
  user?: FlowtiUser;       // set by UserCreationStep
  createdFolders?: string[]; // set by FolderScaffoldStep
  [key: string]: unknown;  // extensible — add your own keys
}
```

A step at order 30 can read values set by steps at order 10 and 20:

```typescript
async execute(context: InstallerContext, deps: InstallerStepDeps) {
  // UserCreationStep (order 10) already set this
  const user = context.user;
  if (!user) {
    return { status: "failed", message: "No user found in context" };
  }

  // FolderScaffoldStep (order 20) already set this
  const folders = context.createdFolders ?? [];
  console.log(`Folders created: ${folders.length}`);

  // ...
}
```

---

## Dependencies Available to Steps

Every step receives `InstallerStepDeps`:

```typescript
interface InstallerStepDeps {
  fileSystem: IFileSystemClient;  // create, read, update, delete files
  eventBus: IEventBus;            // emit and listen to events
  userService: IUserService;      // user CRUD operations
}
```

---

## Restarting the Installer

Users can re-run the setup wizard at any time from **Settings → Flowti → Setup → Restart setup**. This calls `installerService.reset()` to clear the persisted state, then opens the wizard.

Since all steps are idempotent, re-running is safe — `UserCreationStep` skips if a user already exists, `FolderScaffoldStep` skips existing folders.

Programmatically:

```typescript
const installerService = await plugin.getService<IInstallerService>("installerService");
await installerService.reset();
new InstallerWizardModal(app, installerService, eventBus).open();
```

### `IInstallerService.reset()`

Resets the installer state to its default (`installed: false`, empty `completedSteps`) and persists the change to storage. After calling `reset()`, `isInstalled()` returns `false` and the wizard can run the full pipeline again.

---

## Folder Structure

The default folders are defined in `src/domain/installer/folders.ts`:

```
00 - Connectivity/          Data exchange with external systems
  input/  inbox/  imports/  share/  feedback/
01 - Projects/              Big topics you contribute to
02 - Areas/                 Internalized domains you're responsible for
03 - Resources/             Tools, documentation, domain model config
  Attachments/  Bases/  Daily Notes/  Documentation/  Templates/
04 - Archives/              Old and obsolete notes
var/                        External data storage
  data/  events/  reports/
```

To modify the default folders, edit `DEFAULT_IBDE_FOLDERS` in `folders.ts`. Parents must be listed before children for sequential creation to work.

---

## Testing a Custom Step

```typescript
import { describe, it, expect, vi } from "vitest";
import { TemplateDeployStep } from "./TemplateDeployStep";
import type { InstallerContext, InstallerStepDeps } from "../types";

function createMockDeps(): InstallerStepDeps {
  return {
    fileSystem: {
      createFile: vi.fn(),
      readFile: vi.fn(),
      updateFile: vi.fn(),
      deleteFile: vi.fn(),
      moveFile: vi.fn(),
      renameFile: vi.fn(),
      getFrontmatter: vi.fn(),
      updateFrontmatter: vi.fn(),
      setFrontmatter: vi.fn(),
    },
    eventBus: {
      on: vi.fn(() => vi.fn()),
      once: vi.fn(() => vi.fn()),
      emit: vi.fn(),
      clear: vi.fn(),
    } as never,
    userService: {
      load: vi.fn(),
      hasUser: vi.fn(() => false),
      getUser: vi.fn(() => null),
      createUser: vi.fn(),
      updateUserName: vi.fn(),
    },
  };
}

describe("TemplateDeployStep", () => {
  const step = new TemplateDeployStep();

  it("should create template files", async () => {
    const deps = createMockDeps();
    const context: InstallerContext = {};

    const result = await step.execute(context, deps);

    expect(result.status).toBe("completed");
    expect(deps.fileSystem.createFile).toHaveBeenCalled();
    expect(context.deployedTemplates).toBeDefined();
  });

  it("should be idempotent when files exist", async () => {
    const deps = createMockDeps();
    vi.mocked(deps.fileSystem.createFile).mockRejectedValue(
      new Error("File already exists"),
    );
    const context: InstallerContext = {};

    const result = await step.execute(context, deps);

    expect(result.status).toBe("completed");
  });
});
```
