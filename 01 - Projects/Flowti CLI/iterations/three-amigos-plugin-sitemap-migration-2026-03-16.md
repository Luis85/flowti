---
type: ThreeAmigosReview
iteration: 5
scopeItem: "Plugin Sitemap Migration — migrate all 15 legacy views to sitemap-driven architecture"
date: 2026-03-16
aligned: true
---

# Three Amigos Review — Plugin Sitemap Migration

## Scope Item

Migrate all 15 remaining legacy Plugin views to sitemap-driven `SitemapHubView`/`SitemapLeafView` + Lit components, centralizing registration through `SitemapBootstrap`. Remove all legacy view infrastructure.

**Branch:** `feat/iter-5/plugin-sitemap-migration`
**Commits:** 51 commits, 166 files changed (+20,143 / -19,180 lines)
**Spec:** `docs/specs/2026-03-16-plugin-sitemap-migration-design.md`
**Plan:** `docs/plans/2026-03-16-plugin-sitemap-migration.md`

## Product Owner Perspective

- **Value**: Eliminates 15 independent view registration paths in favor of a single declarative path (`plugin-sitemap.json` → `SitemapBootstrap`). Reduces maintenance burden, establishes Lit component library (30+ components), and accelerates future UI feature velocity.
- **Acceptance Criteria**:
  - [x] All 5 hub views render via `SitemapHubView` + Lit components
  - [x] All 8 leaf/panel views render via `SitemapLeafView` + handlers or `fileView` setup classes
  - [x] `SitemapBootstrap.registerAll()` is the sole registration path for views, commands, and ribbon icons
  - [x] No `legacy: true` entries remain in `plugin-sitemap.json`
  - [x] `legacyViewFactories` map removed from `SitemapBootstrapDeps`
  - [x] `legacy` field removed from `ViewDef` interface
  - [x] Full test suite passes (7,883 tests, 0 failures)
  - [x] Zero source-level TypeScript errors
  - [x] Build succeeds
  - [x] Frontend Architecture doc updated

## Software Architect Perspective

- **Technical Approach**: `plugin-sitemap.json` → `SitemapBootstrap` three-branch router (tabs→HubView, handler/component→LeafView, fileView→skip) → `PluginHandlerRegistry` → Lit components with Shadow DOM, design tokens, shared styles. Pure renderers: props in, CustomEvents out.
- **Risks**:
  - (Low) `createViewDefinitions()` returns `[]` — dead code in `registry.ts`, called from `registerAllViews()`. Minor tech debt.
  - (Low) `fileView` views bypass bootstrap — registered via domain setup classes in `onLayoutReady`. Documented, stable, 2 views only.
  - (Non-issue) 14 inline styles in Lit components — all dynamic computed values (correct pattern).
- **Task Breakdown**: 7 chunks executed in dependency order:
  - [x] Chunk 0: Foundation (tokens, shared-styles, conditions, actions, bootstrap)
  - [x] Chunk 1: TrainHub (3 Lit components + handlers)
  - [x] Chunk 2: EventCatalog (2 Lit components + handlers)
  - [x] Chunk 3: DataExchangeHub (9 Lit components + handlers)
  - [x] Chunk 4: UserHub (6 Lit components + handlers)
  - [x] Chunk 5: AnalyticsHub (4 Lit components + handlers)
  - [x] Chunk 6: 8 leaf/panel views (6 handlers + 2 fileViews)
  - [x] Chunk 7: Cleanup (remove legacy infra, update docs)

## Tester Perspective

- **Test Scenarios**: 810 tests across 66 files covering all migration layers:
  - 35 Lit component test files (~300 tests) — rendering, props, CustomEvents, empty states
  - 12 tab handler test files (~180 tests) — registration + wiring
  - 6 leaf handler test files (~100 tests) — orchestrator logic
  - 3 bootstrap/sitemap test files (38 tests) — unit + integration against real sitemap
  - 4 view test files (~60 tests) — SitemapHubView, SitemapLeafView, BaseHubView
  - Full regression: 7,883 tests, 0 failures
- **Edge Cases**:
  - Empty data arrays → verified per component
  - Hot-reload (view already registered) → `safeRegister()` catches and logs
  - Missing handler in registry → bootstrap warns and skips
  - fileView views → bootstrap skips; registered via setup classes
  - Condition evaluation (hidden/disabled) → checkCallback tested both ways
  - View with no tabs/handler/component → registration skipped
- **Test Approach**: Unit + integration + full regression. No E2E (Obsidian runtime not automatable). No visual regression (acceptable gap — Shadow DOM rendering verified via happy-dom).

## Alignment

- Status: **Aligned** — all three perspectives agree the migration is complete, well-tested, and ready to merge.
- No disagreements.
- Minor tech debt noted (dead `registry.ts` code) — can be addressed in a future cleanup pass.
