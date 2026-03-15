# Onboarding Tour System — Design Spec

**Date:** 2026-03-15
**Author:** Alice (Product Manager) + Human
**Status:** Draft
**Approach:** Guided Flow — Hybrid Tour + Sitemap (Approach C)

## Problem

When a project manager clones the Flowti project template and starts the CLI for the first time, there is no guided experience. They land on an empty start screen with no projects and no context. The PM must discover features on their own, which slows adoption and increases the chance they give up or misuse the tool.

## Goal

Build a guided first-run onboarding system where Alice (PM agent persona) collaboratively walks a new project manager through creating their first project and planning their first iteration — training them on the job.

## Success Criteria

- PM completes onboarding in 5-10 minutes
- PM ends with a named project and a planned iteration (in "planned" state)
- PM has used the real iteration planning UI during onboarding (no training-wheels gap)
- Onboarding is resumable (PM can quit and pick up where they left off)
- Architecture supports adding new role-based tours without code changes

---

## Section 1: First-Run Detection & Bootstrap

### Detection Logic (two triggers, both must be true)

1. **No projects exist** — `listProjects()` returns empty
2. **Flag file absent** — `.flowti/onboarding-complete` does not exist

When onboarding completes, the flag file is written. If the PM later deletes all projects but the flag exists, they are not re-onboarded. Re-entry is available via `flowti onboarding:restart`.

### Bootstrap Sequence

1. CLI starts, detects no `flowti.config.json`
2. Scaffolds default config + directory structure (existing `project-config.ts` auto-scaffolding)
3. Checks both triggers — enters onboarding mode
4. Renders welcome screen while scaffolding completes

### File Location

- Detection: `src/domain/onboarding/onboarding-detection.ts`
- Entry point: checked in the main CLI startup path, before the normal sitemap router

---

## Section 2: Onboarding Domain

### Dependency Injection

```typescript
export type OnboardingDeps = Pick<CliDeps, "disk" | "paths" | "input" | "clock" | "log">;
```

The onboarding domain follows the same ISP pattern as all other domains. All file I/O goes through `deps.disk`, all path resolution through `deps.paths`. The onboarding store, detection module, and content loader all receive deps — never import infrastructure singletons.

### Core Types (`src/domain/onboarding/onboarding-types.ts`)

```typescript
Tour           — id, name, description, role, steps[]
TourStep       — id, type, title, contentFile, action?, checkpoint?
TourProgress   — tourId, currentStepIndex, completedSteps[], startedAt
OnboardingState — tours available, active tour, progress, flag
```

### Step Types

| Type | Purpose | Example |
|------|---------|---------|
| `narrate` | Alice explains something, static content from markdown file | "Welcome! Here's what Flowti does..." |
| `prompt` | Alice asks the PM for input | "What would you like to call your project?" |
| `delegate` | Tour navigates to a real sitemap page with onboarding context | Goes to iteration planning page |
| `auto` | Alice does something on the PM's behalf (sensible defaults) | Sets iteration duration to 14 days |
| `checkpoint` | Marks a milestone on the onboarding checklist | "Project created" |

### Tour Definitions

Markdown+frontmatter files in `configs/onboarding/tours/`, alongside `sitemap.json` and `flowti.config.json`. This follows the existing convention of placing data/configuration files in `configs/` rather than `src/`.

```
configs/onboarding/
├── welcome.md
├── tours.json
├── tours/
│   └── project-manager/
│       ├── tour.json
│       ├── steps/
│       │   ├── 01-welcome.md
│       │   ├── 02-tour-selection.md
│       │   └── ...
│       └── hints/
│           └── iteration-planning.md
```

### Tour Engine (`src/domain/onboarding/tour-engine.ts`)

Pure domain function: takes current progress + step definition, returns next action (render content, prompt input, delegate to page, auto-execute, mark checkpoint). No I/O — receives deps via injection. Handles step transitions, skip logic, and "return from delegation."

### Progress Store (`src/domain/onboarding/onboarding-store.ts`)

Persists `TourProgress` to `.flowti/var/onboarding-progress.json`. PM can quit and resume where they left off. All I/O goes through injected `deps.disk` — the store receives `Pick<OnboardingDeps, "disk" | "paths" | "clock">`, matching the pattern used by `lifecycle-store.ts` and other domain stores.

### Content Loading

The tour engine is a pure domain function and cannot read files. Content loading follows the controller-orchestrates pattern:

1. The **controller** (or beforeRender handler) reads the step's markdown file via `deps.disk.readFileSync()`
2. The raw content string is passed to the tour engine's `resolveTemplate()` function
3. The tour engine performs `{{token}}` substitution from its accumulated context and returns the resolved string
4. The controller passes the resolved string to the renderer

This keeps the I/O boundary clean: infrastructure reads, domain transforms, UI renders.

---

## Section 3: Alice as Onboarding Guide

### Dialogue Content

Alice's dialogue is driven by content markdown files, not generated on the fly. Each narration step has a markdown file with frontmatter:

```markdown
---
speaker: Alice
disposition: strategic
---

Great choice! Every good project starts with a clear name.
```

### Template Placeholders

Content files that reference the PM's data use simple `{{token}}` replacement:

```markdown
Nice — **{{projectName}}** is set up and ready.
```

Template resolution is handled by the tour engine before passing content to the renderer. A context object accumulates the PM's inputs throughout the tour.

### Rendering

- Dedicated `onboarding-display.ts` renderer handles Alice's dialogue
- Speaker name and persona styling (subtle color/formatting) distinguishes Alice from normal CLI output
- Teaching content gets distinct visual treatment (indented, different color)

### Auto-Actions (Collaborative)

When Alice sets defaults, she announces what she did and why, then offers confirm/override:

```
Alice: I've set the iteration duration to 14 days — that's a good
starting point. You can always change it later in Iteration Planning.

  Duration: 14 days
  Start date: 2026-03-16
  End date: 2026-03-30

Does that work for you? [Y/n]
```

Alice suggests, never silently decides.

### Auto-Action Dispatch

When the tour engine encounters an `auto` step, it returns an `AutoAction` result containing the action ID (e.g. `project:scaffold`) and context data. The controller handles execution:

1. Controller receives the `AutoAction` from the tour engine
2. Looks up the action in a registry of onboarding auto-actions (separate from sitemap action handlers)
3. Renders Alice's announcement content (what she's about to do)
4. Prompts the PM for confirmation via `deps.input.ask()` (confirm/override)
5. Executes the action (e.g. calls the existing `scaffoldProjectConfig()` domain function)
6. Returns the result to the tour engine to advance to the next step

Auto-actions are distinct from `prompt` steps: prompts collect arbitrary input, auto-actions execute a predetermined operation with a confirm gate.

---

## Section 4: PM Tour — Step Sequence

| # | Type | Step | What Happens |
|---|------|------|-------------|
| 1 | `narrate` | Welcome | Alice introduces herself and gives the Flowti overview |
| 2 | `prompt` | Tour selection | Shows available tours, PM picks one. Auto-selects when only one tour exists |
| 3 | `narrate` | PM tour intro | Alice explains the goal: "you'll have a project with your first iteration planned" |
| 4 | `prompt` | Name your project | PM enters project name |
| 5 | `auto` | Scaffold project | Alice creates project directory, config, management folders. Announces what was created |
| 6 | `checkpoint` | Project created | Checklist: "Project created" |
| 7 | `narrate` | Iterations intro | Alice explains what iterations are and why they matter |
| 8 | `prompt` | Name your iteration | PM enters iteration name/goal |
| 9 | `auto` | Set iteration defaults | Alice sets duration, dates, capacity with confirm/override |
| 10 | `delegate` | Add scope items | Navigates to real iteration planning page (scope section) with onboarding hints active. PM adds 1+ scope items |
| 11 | `checkpoint` | Iteration planned | Checklist: "First iteration planned" |
| 12 | `narrate` | What's next | Alice summarizes what was built, points to Management hub, RAID log, deliverables |
| 13 | `checkpoint` | Tour complete | Writes `.flowti/onboarding-complete`, shows full checklist |

### Key Decisions

- Steps 1-9 run inside the onboarding shell (own pages)
- Step 10 delegates to the real iteration planning page — PM touches the actual UI
- Tour is intentionally short (5-10 minutes)
- After completion, PM lands on the normal Project Detail page, fully oriented

---

## Section 5: Sitemap Integration & Navigation

### New Sitemap Pages

| Page | Path | Kind | Purpose |
|------|------|------|---------|
| `onboarding` | `onboarding` | page | Welcome screen + tour selection |
| `onboarding-tour` | `onboarding/:tourId` | page | Active tour step renderer |
| `onboarding-checklist` | `onboarding/checklist` | page | Progress overview |

### Delegation Mechanism

When the tour reaches a `delegate` step:

1. Tour engine returns a `DelegateAction` with `{ target, tourId, stepId }`
2. The controller pushes the target page onto the sitemap router's navigation stack, passing onboarding context via `StackEntry.params.onboarding = { tourId, stepId }`
3. The delegate page renders normally, but its beforeRender handler checks `ctx.params?.onboarding`:
   - If present: renders Alice's hints (loaded from the step's `hints` file) and a subtle banner: "You're in the PM tour — press `b` when done to continue"
   - If absent: normal rendering (no onboarding awareness needed)
4. When the PM presses back, the router's normal stack-pop behavior returns to the `onboarding-tour` page (which is below the delegate page on the stack). No router modifications needed — delegation uses the existing navigation model.
5. The tour page detects the completed delegation step and advances to the next step

This means no changes to the core `SitemapRouter` — delegation works entirely through the existing stack push/pop mechanism with params passing.

### Startup Routing

```
CLI starts
  → detection check (no projects + no flag file)
    → true:  route to `onboarding` page
    → false: route to normal `start` page
```

### After Onboarding

- Onboarding pages remain in sitemap but are hidden from normal navigation
- Re-accessible via `flowti onboarding:restart` (resets flag file and progress)
- No changes to existing pages — they only gain awareness of an optional onboarding context for rendering hints (additive, not invasive)

### Non-Interactive Commands

Following the CLI convention that every interactive action has a non-interactive equivalent:

| Command | Purpose |
|---------|---------|
| `flowti onboarding:status` | Show current onboarding progress (or "complete" if done) |
| `flowti onboarding:start` | Start or resume onboarding (useful for automation/testing) |
| `flowti onboarding:restart` | Reset flag file and progress, re-enter onboarding |
| `flowti onboarding:skip` | Mark onboarding as complete without running it |

### Configuration

Onboarding is not configurable via `flowti.config.json` in v1. The feature is bundled with the CLI and activates on first-run detection. Future consideration: an `onboarding.enabled` flag for template repos that ship pre-configured.

---

## Section 6: Content File System

### Directory Structure

```
configs/onboarding/
├── welcome.md
├── tours.json
├── tours/
│   └── project-manager/
│       ├── tour.json
│       ├── steps/
│       │   ├── 01-welcome.md
│       │   ├── 02-tour-selection.md
│       │   ├── 03-pm-intro.md
│       │   ├── 04-name-project.md
│       │   ├── 05-scaffold.md          (template)
│       │   ├── 06-project-created.md   (template)
│       │   ├── 07-iterations.md
│       │   ├── 08-name-iteration.md
│       │   ├── 09-defaults.md          (template)
│       │   ├── 10-scope-hints.md       (template)
│       │   ├── 11-iter-planned.md      (template)
│       │   ├── 12-whats-next.md        (template)
│       │   └── 13-complete.md          (template)
│       └── hints/
│           └── iteration-planning.md
```

Content files are loaded at runtime via `deps.disk.readFileSync()` — no build-time bundling needed. The `configs/` directory is already part of the CLI's runtime path resolution.

### tour.json Format

```json
{
  "id": "project-manager",
  "name": "Project Manager",
  "role": "project-manager",
  "description": "Set up your first project and plan your first iteration",
  "steps": [
    { "id": "welcome", "type": "narrate", "content": "steps/01-welcome.md" },
    { "id": "name-project", "type": "prompt", "content": "steps/04-name-project.md",
      "field": "projectName", "validation": "non-empty" },  // validation: "non-empty" | "slug"
    { "id": "scaffold", "type": "auto", "content": "steps/05-scaffold.md",
      "action": "project:scaffold" },
    { "id": "add-scope", "type": "delegate", "content": "steps/10-scope-hints.md",
      "target": "iteration-planning", "hints": "hints/iteration-planning.md" }
  ]
}
```

### Prompt Validation

Prompt steps support a simple validation enum — deliberately minimal compared to the full form engine:

| Validation | Rule |
|-----------|------|
| `non-empty` | Input must not be blank |
| `slug` | Input must be a valid kebab-case identifier |

Custom validation logic (beyond these) would be added as new enum values in `onboarding-types.ts` if needed. The form engine's `ValidationRule` type is not reused here to keep onboarding self-contained.

### Adding New Tours

Create a new folder under `tours/`, add a `tour.json` and step files, register in `tours.json`. No code changes needed.

---

## Section 7: Testing Strategy

### Domain Tests (`tests/domain/onboarding/`)

| Test File | Covers |
|-----------|--------|
| `onboarding-detection.test.ts` | Both triggers, edge cases (flag exists but no projects, projects exist but no flag) |
| `tour-engine.test.ts` | Step transitions, template resolution, delegation context, checkpoint marking, resume from progress |
| `onboarding-store.test.ts` | Progress persistence, read/write/reset, flag file management |

### Controller Tests (`tests/controller/`)

| Test File | Covers |
|-----------|--------|
| `onboarding.controller.test.ts` | `onboarding:start`, `onboarding:restart`, tour selection routing, step execution dispatch |

### UI Tests (`tests/ui/displays/`)

| Test File | Covers |
|-----------|--------|
| `onboarding-display.test.ts` | Alice narration rendering, template placeholder replacement, checkpoint checklist display, hint banner rendering |

### Integration Concerns

- Delegation round-trip: tour → real page → back to tour (tested via controller with mocked navigation)
- Onboarding context on existing pages: verify hints render when context is active, don't render when absent
- Content file loading: verify all step files referenced in `tour.json` exist and parse correctly

### Not Tested

- Content of markdown files (copy, not logic)
- End-to-end CLI interaction (journey test, `describe.skip()` per convention)
