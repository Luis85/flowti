# TUI Onboarding Tour — Design Spec

**Date**: 2026-03-16
**Status**: Approved
**Scope**: Render the onboarding tour inline in the TUI, powered by the existing tour engine domain layer

---

## Problem

The Ink TUI migration replaced the legacy SitemapRouter interactive mode. The onboarding tour — a 12-step guided flow where Alice (PM persona) walks new users through project setup — has no TUI rendering. The prerequisite checker page exists, but the narrative tour does not. Users who launch Flowti for the first time see prerequisites but get no guided setup experience.

## Design Goals

| Priority | Goal |
|----------|------|
| P0 | User completes the 12-step PM tour entirely within the TUI |
| P0 | All 5 step types render inline — no page navigation during the tour |
| P0 | Progress persists — user can quit and resume where they left off |
| P1 | Delegate steps replaced with simplified inline forms |

---

## Architecture

### Page Architecture

One new page: `onboarding-tour-page.tsx`, registered as `"onboarding-tour"`.

**Entry flow:**
- `shouldOnboard()` returns true → TUI starts on existing `onboarding-page` (prerequisite checker)
- Prerequisites pass → user presses "Start Tour" → navigates to `onboarding-tour` with `params.tourId = "project-manager"`

**Layout (three vertical areas):**
1. **Progress bar** — `Step 3 of 12 ━━━━━━━━░░░░` with current step title
2. **Step content** — renders based on step type
3. **Footer** — `Enter Continue` or `Enter Submit` depending on step type

**Progression:** Enter advances to next step. Explicit, predictable, no auto-advance.

**State:** Load tour progress on mount via `readProgress()`. Save via `writeProgress()` after each advance. Resume on re-entry.

### Step Renderers

Five step types rendered within the same content area:

**Narrate** — Alice's name in cyan, step content as wrapped text. Enter to continue.

**Prompt** — Alice's intro text, then an inline form field (reuse existing `FormField` primitive). Field name, placeholder, and validation from tour step definition. Enter submits. Validation failure shows red error, stays on step. Submitted value stored in tour context (e.g., `projectName`).

**Auto** — Alice's intro text, then spinner with action name (e.g., "Scaffolding project..."). Action dispatched using deps from `useTuiContext()`. Success shows green checkmark + summary. Failure shows red error + retry hint. Enter to continue.

**Delegate (simplified)** — Renders as inline mini-form instead of navigating away. For iteration-planning: iteration name field + scope items (one per line). Fields from step definition. Enter submits all fields and runs the associated action.

**Checkpoint** — Checklist of completed milestones (green checkmarks) plus current milestone. Celebratory framing. Enter to continue.

### Alice's Presence

Subtle guide — name shown in cyan but no character framing or roleplay dialogue. Content reads as helpful instructions. No box/border around speech.

### Data Flow

**Tour loader** (`onboarding-tour-loader.ts`) — Loads tour state: reads progress from disk, reads tour definition JSON, resolves current step, templates content with context values (`{{projectName}}`). Returns everything the page needs.

**Action dispatch** — Auto and delegate steps define an `action` string. The page maps these to domain function calls via a small action map:
- `"project:scaffold"` → call `scaffold()` with context values
- `"iteration:set-defaults"` → call iteration create with context values

Only actions the PM tour uses need wiring. Not a general-purpose action system.

**Progress persistence** — `writeProgress()` after each advance with updated step index and context. `readProgress()` on mount to resume.

**Tour completion** — After last step, call `markOnboardingComplete()` (writes flag file), navigate to `"start"` (home page).

---

## File Inventory

| File | Change | LOC |
|------|--------|-----|
| `src/tui/pages/onboarding-tour-page.tsx` | **New** — tour page with step renderer | ~150 |
| `src/tui/loaders/onboarding-tour-loader.ts` | **New** — load tour state + current step | ~40 |
| `src/tui/pages/onboarding-page.tsx` | Modify — add "Start Tour" navigation when prerequisites pass | +10 |
| `src/tui/tui-entry.ts` | Add page import for self-registration | +1 |
| `src/tui/navigation/section-map.ts` | Add `onboarding-tour` to help section pages | +1 |
| `tests/tui/pages/onboarding-tour-page.test.ts` | **New** — step type rendering, progression, progress persistence | ~100 |
| **Total** | | ~300 |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auto actions (scaffold) need full CliDeps but TUI has LoaderDeps | Medium | Scaffold uses `disk`, `paths`, `shell` — all in LoaderDeps. If more deps needed, access via `useTuiContext()` like chat page does |
| Tour JSON not found on disk | Low | Loader returns error state, page shows "Tour not found" message |
| Prompt validation edge cases | Low | Reuse existing `FormField` which already handles validation display |
| Delegate step simplification loses capability | Low | Inline form captures the same essential data (name + scope items). Advanced iteration planning available after onboarding |

---

## Test Strategy

**Unit tests (~6-8):**
- Page registered in registry
- Progress bar renders correct step count
- Narrate step renders Alice name + content
- Prompt step renders form field, accepts input
- Auto step shows spinner then result
- Checkpoint step renders checklist
- Enter advances to next step
- Completion navigates to start page

**Mocking:** Mock tour loader to return controlled step data. Mock deps for auto actions. Domain layer (tour engine, progress store) already tested separately.

---

## What This Does NOT Include

- No new tour content (uses existing 12-step PM tour)
- No additional tour personas (Developer, Architect — future work)
- No changes to the domain layer (tour engine, detection, progress store)
- No changes to non-interactive CLI commands
