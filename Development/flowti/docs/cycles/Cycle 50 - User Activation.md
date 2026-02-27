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
---

# Cycle 50 — User Activation

## Release Anchor Theme

- **Theme 3: User Activation — First 5 Minutes** — If a new user can't get value in 5 minutes, nothing else matters.

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

### Inc 2: Command Catalog — UI View
**Theme**: User Activation
**Effort**: Large

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

### Inc 3: Configurable Startpage (PBI-ONB-014)
**Theme**: User Activation
**Effort**: Medium

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

### Inc 4: Knowledge Base Expansion (TD-87)
**Theme**: User Activation
**Effort**: Medium

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
- [ ] 10+ articles written in `docs/knowledgebase/`
- [ ] Each article has frontmatter (type: Tutorial, domain, difficulty)
- [ ] Articles reference actual commands and views
- [ ] Cross-linked where workflows overlap

### Inc 5: User Hub Idea Capture (PBI-ONB-019)
**Theme**: User Activation
**Effort**: Small

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

### Inc 6: Quick Capture Configuration (PBI-ONB-020)
**Theme**: User Activation
**Effort**: Medium

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

### Inc 7: Onboarding Integration & Polish
**Theme**: User Activation
**Effort**: Small

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
| New tests | ~80 |
| Post-cycle tests | ~5,515 |
| Knowledge base articles | 10+ (from 2) |
| Commands cataloged | All registered commands |
| Onboarding domain tier | Tier 2 (from Tier 3) |
| Increments | 7 |

## Deferred Items

- PBI-ONB-018: Guided tours → future cycle (complex, needs user testing)
- PBI-ONB-015: Role-specific seed data → future cycle
- Command Catalog: keyboard shortcut assignment UI → future cycle
- Command Catalog: command usage analytics → future cycle
