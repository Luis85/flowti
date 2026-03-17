---
type: ThreeAmigosReview
iteration: 5
scopeItem: "Sitemap TUI Renderer — replace hardcoded TUI pages with universal sitemap-driven renderer"
date: 2026-03-17
aligned: true
---

# Three Amigos Review — Sitemap TUI Renderer

## Scope Item

Replace hardcoded TUI pages with a universal sitemap-driven renderer that reads `configs/sitemap.json` and wires actions, forms, data sources, and conditions to Ink components. Not an original iteration-5 scope item — infrastructure work that emerged during Phase B delivery.

**Delivery:** 72 files changed (+2,462 / -1,376), 21 commits, merged to master. 28 hardcoded page files deleted, replaced by a single `SitemapPage` component.

## Product Owner Perspective

- **Value**: The TUI had 35 hardcoded page components that were read-only dashboards — 150+ sitemap actions (build, test, create, delete, navigate) were trapped in the legacy terminal router. This work makes every sitemap action available in the Ink TUI, replacing 28 page files with a single universal renderer.

- **Acceptance Criteria**:
  - [x] Given any page in `sitemap.json`, when rendered in the TUI, then its label, description, actions, and content zone display correctly based on `page.kind`
  - [x] Given a page with actions, when the user presses an action's key, then the correct handler fires (navigate, effect, or signal)
  - [x] Given an effect action (build, test, etc.), when fired, then the EffectStrip shows running state with spinner and displays success/error on completion
  - [x] Given a page with conditions on actions, when conditions evaluate to disabled/hidden, then actions are dimmed or hidden accordingly
  - [x] Given a page with a loader, when navigated to, then data loads and renders in the appropriate kind layout (dashboard, list, or form)
  - [x] Given the custom override pages (agents-chat, onboarding-tour), when navigated to, then they render their custom content instead of the universal renderer

## Software Architect Perspective

- **Technical Approach**:
  - `SitemapPage` is the universal renderer — dispatches content by `page.kind` (dashboard, list, form)
  - `TuiHandlerRegistry` replaces legacy `HandlerRegistry` with pure-domain handler pattern (no terminal I/O)
  - `NavigationContext` lifts nav functions into React context, eliminating prop drilling
  - `loader-map.ts` maps all 28 pageIds to existing loaders
  - `TuiSessionStore` holds pipeline state across navigation
  - `IConditionRegistry` interface extracted for cross-registry condition evaluation

- **Risks**:
  - `dispatchAction` complexity at 15 (lint warning) — could simplify with dispatch table
  - No `command` type rendering (spec Section 4.5) — no command actions in current sitemap
  - No `dialog` kind rendering (spec Section 7.4) — no dialog pages in current sitemap
  - Form submission not wired (rendering present, collect → handler → result missing)
  - Legacy systems not yet deleted (SitemapRouter, form-runner, run-menu, ui/handlers)

- **Follow-up Tasks**:
  - [ ] Wire form submission (collect field data → TuiFormHandler → result)
  - [ ] Add command-output overlay for `command` type actions
  - [ ] Remove legacy handler infrastructure (SitemapRouter, form-runner, run-menu, ui/handlers)
  - [ ] Reduce dispatchAction complexity (dispatch table pattern)

## Tester Perspective

- **Test Scenarios**:
  - [x] SitemapPage renders label, description, actions, content zones by kind (7 tests)
  - [x] ActionBar renders disabled actions dimmed and supports group separators (3 tests)
  - [x] NavigationContext provides navigate/goBack/refresh (2 tests)
  - [x] EffectStrip renders idle/running/success/error states (4 tests)
  - [x] TuiHandlerRegistry register/get/has for handlers/conditions (7 tests)
  - [x] TuiSessionStore create, read/write pipeline state (2 tests)
  - [x] Condition, effect, navigation, data source, CRUD handlers — registered and callable (17+ tests)
  - [x] Hooks: action dispatch, action effect, condition context, sitemap actions (16 tests)

- **Edge Cases (not yet tested)**:
  - Effect cancellation via Escape (spec describes AbortController, not implemented)
  - Multiple rapid action presses (one-at-a-time guard exists but untested)
  - Missing handler at dispatch time (registry throws, no try/catch in dispatchAction)
  - Loader error propagation format
  - CRUD handlers are stubs returning "not available in TUI yet" — tracked, not bugs

- **Test Approach**: 57 new tests across 13 files, all unit/component level. Gap: no integration tests (key press → dispatch → handler → UI update). Recommend adding integration tests as follow-up.

## Alignment

- Status: Aligned
- Priority question resolved: infrastructure work was needed to unblock sitemap-driven TUI — without it, Phase B's RPG world would render pages that users can't interact with
- Follow-up items captured as tasks above — not blockers for current delivery
- Edge cases acknowledged but deferred — current test coverage is solid for the delivered scope
