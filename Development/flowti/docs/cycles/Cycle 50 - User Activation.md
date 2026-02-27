---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: planning
cycle: 50
release_anchor:
  - "Theme 3: User Activation — First 5 Minutes"
pbis:
  - "PBI-ONB-016: Command Catalog"
  - "PBI-ONB-014: Configurable Startpage"
  - "PBI-ONB-019: User Hub Idea Capture"
  - "PBI-ONB-020: Quick Capture Configuration"
  - "TD-87: Knowledge base expansion"
bugs: []
tech_debt:
  - TD-87
estimated_increments: 7
estimated_tests: 80
pre_cycle_tests: 5452
pre_cycle_suites: 232
---

# Cycle 50 — User Activation

## Release Anchor Theme

- **Theme 3: User Activation — First 5 Minutes** — If a new user can't get value in 5 minutes, nothing else matters.

## Situation Assessment

### Codebase Health
- **Production LOC**: ~25,000+ across 11 domain services
- **Tests**: 5,452 passing (232 suites), 0 failures
- **Build**: `npm run build` green
- **Lint**: `npm run check` → 0 errors, 0 warnings
- **Previous cycle**: C49 closed (stage: `done`, 2026-02-27), all 6 increments delivered, 137 tests added

### Onboarding Domain Maturity
- **Tier**: 3 (basic)
- **OnboardingService**: 213 LOC, manages getting-started checklist with 5 milestones
- **Events**: 4 types (`onboarding.started`, `onboarding.step.completed`, `onboarding.completed`, `onboarding.reset`)
- **Tests**: 1 test file
- **Phase 1** (C45/C46): Delivered — post-install welcome guide, checklist, empty states, seed data
- **Phase 2**: Delivered — contextual callouts, reset from Settings, standalone service, lifecycle events

### Command Infrastructure
- **CommandRegistry**: 247 LOC with `ICommandRegistry` interface
- **Commands registered**: 40+ across all domains
- **Current interface**: `CommandDefinition { id, name, hotkeys?, icon?, mobileOnly?, handler }`
- **Missing**: No `description`, `domain`, or `category` fields — commands are executable but not discoverable
- **Events**: 4 types (`command.registered`, `command.executing`, `command.executed`, `command.failed`)

### Quick Capture Infrastructure
- **QuickCaptureModal**: 131 LOC, supports 11 capture types (idea, note, task, question, feedback, bug, learning, risk, assumption, issue, decision)
- **CaptureService**: 100 LOC, stateless, creates vault notes
- **Events**: 3 types (`capture.idea.created`, `capture.feedback.created`, `capture.note.created`)
- **Missing**: No per-command configuration (folder, template selection)

### User Hub State
- **UserHubView**: 455 LOC with 3 tabs (Sessions, Inbox, Preferences) + dashboard
- **Sub-components**: 10 files in `src/ui/userHub/`
- **Missing**: No idea capture affordance on dashboard

### Knowledge Base
- **Tutorial articles**: 2 (`How to use daily notes`, `Creating a Service`)
- **Process/reference docs**: 8 lifecycle + 3 reference documents
- **Type documentation**: 35+ TypeDoc files
- **Gap**: Users who get stuck have no self-service workflow guidance

### Open Issues
- No critical bugs open
- No release blockers targeting C50

## Cycle Overview

Cycle 50 is entirely dedicated to the new user journey — from plugin install to first "aha moment." The onboarding domain is currently Tier 3 (basic: 213 LOC service, 1 test file). Only 2 knowledge base articles exist. There is no command discovery mechanism, no configurable landing page, and no guided capture workflow. This cycle addresses all of these gaps.

The milestone: **a new user installs Flowti, sees a meaningful startpage, discovers commands through a browsable catalog, captures their first idea, and has tutorials available when they get stuck.**

## User Pains

1. **No command discovery** — 40+ commands exist but users must know them by name. No browsable index, no domain grouping, no search (PBI-ONB-016).
2. **Default view is arbitrary** — Opening the vault shows whatever Obsidian defaults to, not a Flowti-curated landing experience (PBI-ONB-014).
3. **Knowledge base is nearly empty** — Only 2 articles (daily notes guide, creating a service tutorial). Users who get stuck have no self-service path (TD-87).
4. **No quick idea capture from User Hub** — The primary dashboard has no "capture an idea" affordance despite ideas being central to IBDE philosophy (PBI-ONB-019).
5. **Quick capture is unconfigurable** — No per-command target folder or template selection (PBI-ONB-020).

## Cycle Goals

1. **Build a browsable Command Catalog** grouped by domain with search and descriptions
2. **Implement configurable startpage** — user selects which view opens on vault load
3. **Expand knowledge base** to 10+ tutorial articles covering core workflows
4. **Add idea capture section** to User Hub dashboard
5. **Make Quick Capture configurable** with per-command folder and template settings

## Scope

### In Scope
- PBI-ONB-016: Command Catalog (browsable, searchable, domain-grouped)
- PBI-ONB-014: Configurable Startpage (settings toggle, view selector)
- TD-87: Knowledge base expansion (10+ articles)
- PBI-ONB-019: User Hub idea capture section
- PBI-ONB-020: Quick Capture per-command configuration

### Out of Scope
- Guided tours (PBI-ONB-018) — deferred, too complex for this cycle
- Role-specific seed data (PBI-ONB-015) — deferred
- AI-assisted classification — deferred beyond C55
- Onboarding service major refactoring — service extension only

## Increments

### Inc 1: Command Catalog — Data Model & Registry
**Theme**: User Activation
**Effort**: Medium
**Estimate**: +150 LOC production, +80 LOC test, ~15 tests

Extend CommandRegistry to expose metadata for all registered commands:
- Add `CommandMeta` interface: `{ id, label, description, domain, category, icon?, shortcut? }`
- Annotate all existing command registrations with metadata
- Expose `getCommands()` and `getCommandsByDomain()` on CommandRegistry
- Count all commands and validate completeness

**Acceptance Criteria**:
- [ ] CommandMeta interface defined
- [ ] All registered commands annotated with domain, description, category
- [ ] Registry exposes queryable command list
- [ ] Unit tests for registry queries
- [ ] `npm test` green

**Test Intent**: ~15 unit tests covering: CommandMeta interface validation, `getCommands()` returns all registered commands, `getCommandsByDomain()` groups correctly, metadata completeness check (no commands missing description/domain), edge cases (empty registry, unknown domain).

**Documentation Intent**: Update CommandRegistry JSDoc with CommandMeta extension documentation. TD-87 articles may reference catalog commands.

**Architecture Seams**:
- `CommandMeta` extends existing `CommandDefinition` in `src/infrastructure/commands/types.ts` — additive, backward-compatible
- `getCommandsByDomain()` added to `ICommandRegistry` interface in `src/infrastructure/commands/CommandRegistry.ts`
- Command metadata annotated at registration sites across domain modules (40+ commands)
- No new events — existing `command.registered` event unchanged

**Files**:
- Modified: `src/infrastructure/commands/types.ts` (~30 LOC), `src/infrastructure/commands/CommandRegistry.ts` (~40 LOC)
- Modified: command registration files across domains (~80 LOC annotations)
- New: `tests/infrastructure/commands/CommandRegistry.meta.test.ts` (~80 LOC)

### Inc 2: Command Catalog — UI View
**Theme**: User Activation
**Effort**: Large
**Estimate**: +350 LOC production, +120 LOC test, ~20 tests

Build the Command Catalog as a browsable, searchable view:
- New tab in Event Catalog Hub (or standalone view — decide during implementation)
- Master list grouped by domain with expand/collapse
- Search bar filtering by label, description, or domain
- Detail panel showing description, shortcut, domain context
- Click-to-execute for applicable commands

**Acceptance Criteria**:
- [ ] Command Catalog view renders all registered commands
- [ ] Grouping by domain works correctly
- [ ] Search filters across label, description, domain
- [ ] Detail panel shows full command metadata
- [ ] UI tests for rendering and filtering
- [ ] `npm test` green

**Test Intent**: ~20 tests covering: view renders all commands from registry, domain grouping produces correct groups, search filtering by label/description/domain, detail panel shows metadata for selected command, click-to-execute dispatches command, empty state when no commands match search, keyboard navigation (if implemented).

**Documentation Intent**: None (the UI is self-documenting as a discoverable catalog). Knowledge base "Getting Started" article will reference the catalog.

**Architecture Seams**:
- View follows `BaseHubView` pattern (tab-based layout with master/detail split) — extends existing `src/ui/BaseHubView.ts`
- Consumes `ICommandRegistry.getCommands()` and `getCommandsByDomain()` from Inc 1
- Uses established `buildSplitLayout()` helper from `src/ui/catalog/helpers.ts`
- Component dependency injection via `CommandCatalogDeps` interface (following `UserHubComponentDeps` pattern)
- No new events produced — command execution via existing `command.executing`/`command.executed` events

**Files**:
- New: `src/ui/commandCatalog/CommandCatalogView.ts` (~250 LOC), `src/ui/commandCatalog/CommandCatalogList.ts` (~100 LOC)
- New: `tests/ui/commandCatalog/CommandCatalogView.test.ts` (~120 LOC)
- Modified: Hub registration to add catalog tab/view

### Inc 3: Configurable Startpage (PBI-ONB-014)
**Theme**: User Activation
**Effort**: Medium
**Estimate**: +100 LOC production, +60 LOC test, ~12 tests

Allow users to configure which view opens on vault load:
- Add `startPage` setting to SettingsService (default: none / Obsidian default)
- Options: User Hub, Event Catalog, Data Exchange Hub, Analytics Hub, Train Hub, None
- On `layout-ready` event, open configured view if set
- Settings UI: dropdown in Settings tab under "General"

**Acceptance Criteria**:
- [ ] Setting persisted across vault restarts
- [ ] Configured view opens on layout-ready
- [ ] "None" option preserves Obsidian default behavior
- [ ] Setting UI integrated into Settings tab
- [ ] Unit tests for startpage logic
- [ ] `npm test` green

**Test Intent**: ~12 tests covering: setting default is "none", setting persists via SettingsService, `layout-ready` handler opens configured view, "None" skips view activation, each view type option maps to correct leaf type, settings UI renders dropdown with all options, backward compatibility (settings without `startPage` field default to "none").

**Documentation Intent**: Knowledge base "Getting Started" article will reference startpage configuration. Settings section in user guide updated.

**Architecture Seams**:
- `startPage` field added to `FlowtiSettings` interface in `src/domain/settings/types.ts` — optional string union, backward-compatible
- `settings.changed` event propagates startpage changes (existing SettingsService pattern)
- `layout-ready` listener in plugin `onLayoutReady()` — `src/main.ts` or dedicated `StartpageHandler`
- View activation via Obsidian `workspace.getLeaf()` API — follows existing hub activation pattern
- Settings UI: dropdown in existing Settings tab using established `buildDropdown()` helper

**Files**:
- Modified: `src/domain/settings/types.ts` (~10 LOC), `src/domain/settings/SettingsService.ts` (~15 LOC)
- New or modified: `src/infrastructure/StartpageHandler.ts` (~50 LOC)
- Modified: Settings UI tab (~25 LOC)
- New: `tests/infrastructure/StartpageHandler.test.ts` (~60 LOC)

### Inc 4: Knowledge Base Expansion (TD-87)
**Theme**: User Activation
**Effort**: Medium
**Estimate**: +0 LOC production, +0 LOC test, 0 tests (documentation-only)

Write 10+ tutorial articles covering core workflows:
- Getting Started with Flowti
- Understanding Domains and Events
- Creating Your First Event Definition
- Working with Sessions
- Building Data Exchange Configs
- Importing CSV Data
- Creating Analytics Queries
- Building Dashboards
- Using the Train of Thought
- Connecting to Azure DevOps (Signal)
- Using Quick Capture
- Understanding the Inbox

**Acceptance Criteria**:
- [ ] 10+ articles written in `docs/knowledgebase/tutorials/`
- [ ] Each article has frontmatter (type: Tutorial, domain, difficulty)
- [ ] Articles reference actual commands and views
- [ ] Cross-linked where workflows overlap

**Test Intent**: None — documentation-only increment with no code changes.

**Documentation Intent**: These ARE the documentation. 12 tutorial articles created in `docs/knowledgebase/tutorials/`. TD-87 resolved upon completion.

**Architecture Seams**: None — pure documentation. No production code changes.

**Files**:
- New: 12 markdown files in `docs/knowledgebase/tutorials/`

### Inc 5: User Hub Idea Capture (PBI-ONB-019)
**Theme**: User Activation
**Effort**: Small
**Estimate**: +80 LOC production, +60 LOC test, ~10 tests

Add an "Idea Capture" section to the User Hub dashboard:
- Prominent text input at top of User Hub
- Submitting creates a new inbox note with `type: Idea`, `origin: user-hub`
- Optional: recent ideas list (last 5) below input
- Leverages existing Quick Capture infrastructure

**Acceptance Criteria**:
- [ ] Idea capture input visible on User Hub
- [ ] Submitting creates typed inbox note
- [ ] Recent ideas displayed below input
- [ ] UI tests for capture and display
- [ ] `npm test` green

**Test Intent**: ~10 tests covering: capture input renders on dashboard, submitting with text calls CaptureService with correct type/origin, empty submission prevented, recent ideas list queries inbox for type:Idea, recent ideas list displays last 5, capture clears input after submission, error handling for capture failure, UI state updates after successful capture.

**Documentation Intent**: Knowledge base "Using Quick Capture" tutorial will reference User Hub idea capture.

**Architecture Seams**:
- New `IdeaCaptureSection` component in `src/ui/userHub/IdeaCaptureSection.ts` — follows existing `UserHubComponentDeps` pattern
- Reuses `CaptureService.capture()` from `src/domain/capture/CaptureService.ts` — no service changes needed
- Queries `InboxService` for recent ideas (existing `getItems()` with type filter)
- Integrated into `UserHubDashboard.ts` render method — standard component composition
- Events: reuses existing `capture.idea.created` event

**Files**:
- New: `src/ui/userHub/IdeaCaptureSection.ts` (~80 LOC)
- Modified: `src/ui/userHub/UserHubDashboard.ts` (~10 LOC integration)
- New: `tests/ui/userHub/IdeaCaptureSection.test.ts` (~60 LOC)

### Inc 6: Quick Capture Configuration (PBI-ONB-020)
**Theme**: User Activation
**Effort**: Medium
**Estimate**: +120 LOC production, +80 LOC test, ~15 tests

Make Quick Capture configurable per command:
- Add `captureConfig` to settings: `{ defaultFolder, defaultTemplate, defaultType }`
- Per-capture-command overrides (e.g., different folder for "Capture Idea" vs "Capture Bug")
- Template selector in Quick Capture modal
- Folder selector in Quick Capture modal

**Acceptance Criteria**:
- [ ] Default folder configurable in settings
- [ ] Default template configurable in settings
- [ ] Per-command overrides supported
- [ ] Quick Capture modal shows folder/template selectors
- [ ] Unit tests for configuration resolution
- [ ] `npm test` green

**Test Intent**: ~15 tests covering: default config resolution (folder, template, type), per-command override takes precedence over default, missing override falls back to default, settings persistence, modal renders folder selector, modal renders template selector, folder selector lists vault folders, template selector lists available templates, config changes reflect in next capture, backward compatibility (settings without captureConfig use hardcoded defaults).

**Documentation Intent**: Knowledge base "Using Quick Capture" tutorial will cover configuration. Settings reference updated.

**Architecture Seams**:
- `CaptureConfig` interface added to `src/domain/capture/types.ts` — `{ defaultFolder, defaultTemplate, defaultType, overrides?: Record<CaptureType, Partial<CaptureConfig>> }`
- `captureConfig` field added to `FlowtiSettings` in `src/domain/settings/types.ts` — optional, backward-compatible
- `resolveCaptureConfig(type: CaptureType, settings: FlowtiSettings): ResolvedCaptureConfig` — pure function for config resolution
- `QuickCaptureModal` enhanced with folder/template dropdown selectors — extends existing modal in `src/ui/capture/QuickCaptureModal.ts`
- Settings UI: new "Capture" section in Preferences tab using existing form helpers

**Files**:
- Modified: `src/domain/capture/types.ts` (~20 LOC), `src/domain/settings/types.ts` (~10 LOC)
- New: `src/domain/capture/resolveCaptureConfig.ts` (~40 LOC)
- Modified: `src/ui/capture/QuickCaptureModal.ts` (~50 LOC)
- New: `tests/domain/capture/resolveCaptureConfig.test.ts` (~80 LOC)

### Inc 7: Onboarding Integration & Polish
**Theme**: User Activation
**Effort**: Small
**Estimate**: +60 LOC production, +40 LOC test, ~8 tests

Wire all new features into the onboarding flow:
- Add Command Catalog to onboarding checklist
- Add startpage configuration to onboarding steps
- Update callouts on relevant Hub views to mention new features
- Verify first-run experience end-to-end

**Acceptance Criteria**:
- [ ] Onboarding checklist updated with new steps
- [ ] Callouts reference Command Catalog and Startpage
- [ ] Manual end-to-end walkthrough documented
- [ ] `npm test` green

**Test Intent**: ~8 tests covering: onboarding checklist includes new milestones (catalog explored, startpage configured), milestone completion updates onboarding progress, callout content references new features, callout dismissal persists, onboarding completion fires with updated milestone count, backward compatibility (existing onboarding state without new milestones remains valid).

**Documentation Intent**: Manual end-to-end walkthrough documented in cycle retrospective. Onboarding PRD Phase 3 status updated.

**Architecture Seams**:
- `OnboardingMilestones` interface extended with new optional boolean fields in `src/domain/onboarding/types.ts` — backward-compatible
- Callout content strings updated in relevant Hub views — follows existing callout pattern with `isCalloutDismissed()` guard
- `OnboardingService.initChecklist()` initializes new milestones as `false` for existing users
- No new events — existing `onboarding.step.completed` handles new milestones

**Files**:
- Modified: `src/domain/onboarding/types.ts` (~10 LOC), `src/domain/onboarding/OnboardingService.ts` (~20 LOC)
- Modified: Hub views with callout updates (~30 LOC across 2-3 files)
- New: `tests/domain/onboarding/OnboardingService.milestones.test.ts` (~40 LOC)

## Dependency Graph

```
Inc 1 (Catalog Data) ──→ Inc 2 (Catalog UI)
Inc 3 (Startpage)    ──→ Independent
Inc 4 (Knowledge)    ──→ Independent
Inc 5 (Idea Capture) ──→ Independent
Inc 6 (QC Config)    ──→ Independent
Inc 7 (Integration)  ──→ Depends on Inc 1–6
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Command Catalog scope creep (too many UI features) | Medium | MVP: list + search + grouping. Polish in later cycle |
| Knowledge base articles become stale | Low | Reference actual commands; update as features change |
| Startpage conflicts with Obsidian workspace restore | Medium | Only open if no workspace state exists; respect "None" |
| Quick Capture config adds settings complexity | Low | Group under "Capture" section in settings |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~80 (Inc 1: 15, Inc 2: 20, Inc 3: 12, Inc 5: 10, Inc 6: 15, Inc 7: 8) |
| Production LOC added | ~860 |
| Post-cycle tests | ~5,532 |
| Knowledge base articles | 10+ (from 2) |
| Commands cataloged | All registered commands |
| Onboarding domain tier | Tier 2 (from Tier 3) |
| Increments | 7 |

## Deferred Items

- PBI-ONB-018: Guided tours → future cycle (complex, needs user testing)
- PBI-ONB-015: Role-specific seed data → future cycle
- Command Catalog: keyboard shortcut assignment UI → future cycle
- Command Catalog: command usage analytics → future cycle
