---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - installer.started
  - installer.step.started
  - installer.step.completed
  - installer.completed
  - installer.failed
  - installer.loaded
maturity: L5
business_value: 4
implementation_cost: 3
maintenance_cost: 1
discovery_cost: 2
design_cost: 3
test_cost: 2
priority: 4
---

# Installer PRD

> Architecture reference: [[Installer]]

## 1. Problem Statement

First-time users of Flowti IBDE face a cold-start problem: the vault has no folder structure, no user profile, and no configuration. Without guided setup, users must manually create folders, understand the PARA methodology, and configure the plugin -- leading to confusion, inconsistent setups, and poor first impressions. The plugin needs a zero-friction onboarding mechanism that runs once and gets the vault into a productive state.

## 2. Outcome

When a user installs Flowti for the first time, a 4-page setup wizard automatically appears. It collects the user's name, previews what will be created, runs an extensible pipeline of setup steps (user profile creation, PARA folder scaffolding), and confirms completion. The entire process is idempotent, can be restarted from Settings, and can be extended with custom steps by developers.

## 3. Scope

### In Scope

- First-run detection via persisted installer state
- 4-page wizard modal (Welcome, Review, Progress, Complete)
- User profile creation step (order 10)
- PARA-based folder scaffolding step (order 20)
- Extensible step pipeline with `IInstallerStep` interface
- Shared context passing between steps
- Step ordering by `order` field
- Idempotent execution (safe to re-run)
- Restart capability from Settings
- Event emission for all pipeline stages
- Persistence of installer completion state

### Out of Scope

- Template deployment (can be added as custom step)
- Plugin configuration beyond user profile
- Vault migration from other systems
- Multi-user vault setup
- Undo/rollback of installed steps

## 4. UX Entry Points

- **Automatic**: Wizard opens on first plugin load when `isInstalled()` returns `false`
- **Settings**: "Restart setup" button under Settings > Flowti > Setup
- **Programmatic**: `installerService.reset()` + `InstallerWizardModal.open()`

## 5. Functional Requirements

- [x] Detect first-run state via persisted storage key `installer`
- [x] Display 4-page wizard modal: Welcome (name input), Review (step preview), Progress (execution), Complete (confirmation)
- [x] Execute `UserCreationStep` (order 10) to create user profile via `userService.createUser()`
- [x] Execute `FolderScaffoldStep` (order 20) to create PARA folder structure with `.gitkeep` placeholders
- [x] Sort and execute steps by `order` field
- [x] Pass shared `InstallerContext` between steps
- [x] Halt pipeline on step failure with error reporting
- [x] Persist completion state so wizard does not reappear
- [x] Allow step registration via `installerService.registerStep()`
- [x] Reject duplicate step IDs with `ValidationError`
- [x] Provide `InstallerStepDeps` (fileSystem, eventBus, userService) to each step
- [x] Support restart via `installerService.reset()` from Settings
- [x] All built-in steps are idempotent (skip if already done)

## 6. Data Model Impact

| Entity | Fields | Storage |
|--------|--------|---------|
| `InstallerState` | installed (boolean), completedSteps (string[]) | `installer` storage key |
| `InstallerContext` | userName?, user?, createdFolders?, [extensible] | Runtime (passed between steps) |
| `IInstallerStep` | id, name, description, intro, order, execute() | Registered in service |
| `InstallerStepResult` | status ("completed"/"skipped"/"failed"), message, error? | Runtime |
| `DEFAULT_IBDE_FOLDERS` | Array of folder path strings | Constant in `folders.ts` |

## 7. Event Impact

### Produced

- `installer.started` -- Pipeline execution begins (payload: stepCount)
- `installer.step.started` -- Individual step begins (payload: stepId, stepName)
- `installer.step.completed` -- Individual step finishes (payload: id, name, status, message)
- `installer.completed` -- Pipeline finished successfully (payload: state)
- `installer.failed` -- Pipeline halted on error (payload: failedStepId, error)
- `installer.loaded` -- Persisted state loaded (payload: state)

### Consumed

- None (installer is a producer-only domain)

## 8. UI Layout Impact

- **InstallerWizardModal**: 4-page Obsidian Modal
  - Page 1 (Welcome): User name text input, intro text
  - Page 2 (Review): Card per step showing name, description, and intro text
  - Page 3 (Progress): Step-by-step execution with status indicators
  - Page 4 (Complete): Success confirmation with summary
- **Settings**: "Restart setup" button added to Flowti settings tab

## 9. Adapter Impact

- `InstallerService`: Step registry, pipeline executor, state persistence
- `FileSystemClient`: Used by `FolderScaffoldStep` to create folders with `.gitkeep` files
- `IUserService`: Used by `UserCreationStep` to create user profile
- `IStorageProvider`: Persists `InstallerState` under `installer` key
- Service registered in `registry.ts` with `userService` dependency

## 10. Non-Functional Requirements

- Wizard must open within 1 second of plugin load on first run
- Full pipeline (2 built-in steps) must complete within 5 seconds
- All steps must be idempotent -- re-running produces no duplicate artifacts
- Step execution must be sequential (order-dependent context sharing)
- Pipeline must halt immediately on first step failure

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Folder creation fails due to permissions | High | Error reporting in wizard; step returns `failed` status |
| User cancels wizard mid-execution | Medium | Idempotent steps allow safe restart |
| Custom step throws unhandled exception | Medium | Try/catch in pipeline executor; emits `installer.failed` |
| Storage corruption loses installer state | Low | `reset()` allows manual restart from Settings |

## 12. Acceptance Criteria

- [x] Wizard opens automatically on first plugin load
- [x] Wizard does not open on subsequent loads after successful completion
- [x] User profile is created with the entered name
- [x] All PARA folders are created with `.gitkeep` files
- [x] Wizard shows step-by-step progress during execution
- [x] Pipeline halts and reports error if a step fails
- [x] "Restart setup" in Settings resets state and reopens wizard
- [x] Re-running the wizard skips already-existing folders and user
- [x] Custom steps registered before `runAll()` execute in correct order
- [x] Duplicate step ID registration throws `ValidationError`
- [x] All 6 installer events emit with correct payloads

## 13. Definition of Done

- All acceptance criteria verified manually
- Unit tests cover InstallerService, UserCreationStep, FolderScaffoldStep
- Pipeline execution tested with mock steps (success, skip, failure scenarios)
- Context passing between steps tested
- Event emission verified in tests
- `npm run build` passes (vitest, tsc, eslint, esbuild)
