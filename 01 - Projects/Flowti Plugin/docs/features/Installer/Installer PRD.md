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
priority: 0
---

# Installer PRD

> Architecture reference: [[Installer]]

## 1. Problem Statement

First-time users of Flowti IBDE face a cold-start problem: the vault has no folder structure, no user profile, and no configuration. Without guided setup, users must manually create folders, understand the PARA methodology, and configure the plugin -- leading to confusion, inconsistent setups, and poor first impressions. The plugin needs a zero-friction onboarding mechanism that runs once and gets the vault into a productive state.

## 2. Outcome

When a user installs Flowti for the first time, a 5-page setup wizard automatically appears. It collects the user's name, allows role selection (User or Supplier Manager), previews what will be created in categorised sections, runs an extensible pipeline of setup steps (user profile creation, PARA folder scaffolding, optional content seeding), and confirms completion. The entire process is idempotent, can be restarted from Settings, and can be extended with custom steps by developers.

## 3. Scope

### In Scope

- First-run detection via persisted installer state
- 5-page wizard modal (Welcome, Role, Review, Progress, Complete)
- Role selection (User or Supplier Manager) with persona descriptions
- User profile creation step (order 10) with role context
- PARA-based folder scaffolding step (order 20) with versioned JSON config
- Seed content step (order 30) with role-conditional session templates
- Extensible step pipeline with `IInstallerStep` interface
- Shared context passing between steps
- Step ordering by `order` field
- Idempotent execution (safe to re-run)
- Restart capability from Settings
- Event emission for all pipeline stages
- Persistence of installer completion state

### Out of Scope

- Plugin configuration beyond user profile and role
- Vault migration from other systems
- Multi-user vault setup
- Undo/rollback of installed steps

## 4. UX Entry Points

- **Automatic**: Wizard opens on first plugin load when `isInstalled()` returns `false`
- **Settings**: "Restart setup" button under Settings > Flowti > Setup
- **Programmatic**: `installerService.reset()` + `InstallerWizardModal.open()`

## 5. Functional Requirements

- [x] FR-1: Detect first-run state via persisted storage key `installer`
- [x] FR-2: Display 5-page wizard modal: Welcome (name input), Role (persona selection), Review (categorised preview), Progress (execution), Complete (confirmation)
- [x] FR-3: Execute `UserCreationStep` (order 10) to create user profile via `userService.createUser()` with role context
- [x] FR-4: Execute `FolderScaffoldStep` (order 20) to create PARA folder structure with `.gitkeep` placeholders using versioned JSON folder config (`DEFAULT_FOLDER_CONFIG`)
- [x] FR-5: Execute `SeedContentStep` (order 30) to seed starter content (sample notes, optional session templates for supplier-manager role)
- [x] FR-6: Sort and execute steps by `order` field
- [x] FR-7: Pass shared `InstallerContext` (userName, role, user, createdFolders) between steps
- [x] FR-8: Halt pipeline on step failure with error reporting
- [x] FR-9: Persist completion state so wizard does not reappear
- [x] FR-10: Allow step registration via `installerService.registerStep()`
- [x] FR-11: Reject duplicate step IDs with `ValidationError`
- [x] FR-12: Provide `InstallerStepDeps` (fileSystem, eventBus, userService) to each step
- [x] FR-13: Support restart via `installerService.reset()` from Settings
- [x] FR-14: All built-in steps are idempotent (skip if already done)

### Cycle 46 — Role Selection & Wizard UX (v2)

- [x] FR-15: Role selection page with two personas: "User" (default, general-purpose) and "Supplier Manager" (operations-focused); role stored in `InstallerContext.role`
- [x] FR-16: Versioned folder config (`DEFAULT_FOLDER_CONFIG` v1) with folder paths, descriptions, and display names — replaces hardcoded `DEFAULT_IBDE_FOLDERS` array
- [x] FR-17: Categorised review page with 3 sections: "Folder Structure" (folder names + descriptions from config), "Sample Content" (notes to be seeded), "Pre-Built Dashboard" (supplier analytics dashboard)
- [x] FR-18: Role-conditional content in review — supplier-manager role shows "3 session templates" in Sample Content section; user role omits session templates
- [x] FR-19: Keyboard navigation on all wizard pages — Enter advances forward, Escape goes back (or closes on welcome); scoped `keydown` listener with cleanup on page transitions
- [x] FR-20: Post-install trigger seeds supplier dashboard via `seedSupplierDashboard()` and initializes onboarding checklist via `initOnboardingChecklist()` on `installer.completed` event

## 6. Data Model Impact

| Entity | Fields | Storage |
|--------|--------|---------|
| `InstallerState` | installed (boolean), completedSteps (string[]) | `installer` storage key |
| `InstallerContext` | userName?, role? (`"user" \| "supplier-manager"`), user?, createdFolders?, [extensible] | Runtime (passed between steps) |
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

- **InstallerWizardModal**: 5-page Obsidian Modal (574 LOC)
  - Page 1 (Welcome): User name text input, intro text
  - Page 2 (Role): Two persona cards (User / Supplier Manager) with descriptions, radio selection
  - Page 3 (Review): Categorised preview in 3 sections (Folder Structure, Sample Content, Pre-Built Dashboard)
  - Page 4 (Progress): Step-by-step execution with status indicators
  - Page 5 (Complete): Success/failure confirmation with explore or close actions
  - Keyboard navigation: Enter (advance), Escape (back/close) on all pages
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

## 14. Extended Backlog (from Inbox Triage 2026-02-20)

| PBI | Title | Status | Priority | Source |
|-----|-------|--------|----------|--------|
| [[PBI-001 First Run Setup]] | First-run setup wizard | Done | — | Original scope |
| [[PBI-002 Seed Starter Content]] | Seed example content on first run | Done (C46) | High (RB-4) | [[Installer should seed starter content on first run]] |
| [[PBI-003 Pluggable Step Registry]] | Config-driven step registry | Discovery | Low | [[Installer step registry should support pluggable steps from config]] |
| [[PBI-004 Folder Mapping]] | Customizable folder-to-concept mapping | Discovery | Medium | [[I must be able to map Flowti Concept Folders to different folder structures for better adaptability]] |
| [[PBI-005 JSON Folder Config]] | Versioned JSON folder config instead of hardcoded paths | Done (C46) | High (RB-1) | [[I want the installer to use a versioned JSON folder config instead of hardcoded paths]], [[I want to provide a folder-structure as json to the installer]] |
| [[PBI-006 CLI Installer]] | CLI-based installer starting from README for automated setup | Discovery | Medium | [[I want to have a CLI based Installer starting from the README]] |
| [[PBI-007 Role Selection]] | Role selection page with User/Supplier Manager personas | Done (C46) | High | Cycle 46 Inc 2 |
| [[PBI-008 Categorised Review]] | Categorised review page with 3 sections | Done (C46) | Medium | Cycle 46 Inc 5 |
| [[PBI-009 Keyboard Navigation]] | Enter/Escape keyboard navigation on all wizard pages | Done (C46) | Medium | Cycle 46 Inc 5 |

> **Inbox triage (2026-02-22):** 2 new PBIs added. PBI-005 consolidates 2 inbox items about JSON-based folder configuration (relates to RB-1 repository restructure for marketplace). PBI-006 for CLI-based installer for automation/scripting use cases.
> **Cycle 46 — Supplier Manager Onboarding II (2026-02-26):** Major wizard expansion. 4→5 pages (added Role selection). 13→20 FRs. PBI-002 (seed content), PBI-005 (JSON folder config), PBI-007 (role selection), PBI-008 (categorised review), PBI-009 (keyboard nav) all delivered. Versioned `DEFAULT_FOLDER_CONFIG` replaces hardcoded folder array. Role-conditional content seeding (session templates for supplier-manager). Post-install hooks: `seedSupplierDashboard()` + `initOnboardingChecklist()`. 10 new unit tests (InstallerWizardModal.test.ts). Total: 20 FRs, 9 PBIs (5 done, 1 planned, 3 discovery).
