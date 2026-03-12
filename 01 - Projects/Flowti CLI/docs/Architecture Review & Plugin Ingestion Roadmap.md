---
type: Review
domain: CLI
title: Architecture Review & Plugin Ingestion Roadmap
version: 1
created: 2026-03-12
updated: 2026-03-12
status: active
source: "[[Flowti CLI Architecture]]"
plugin_integration: "[[Plugin Integration Analysis]]"
tech_debt: "[[Tech Debt]]"
---

# Architecture Review & Plugin Ingestion Roadmap

> Comprehensive review of the Flowti CLI architecture (v22), fit-gap analysis for Plugin ingestion, and phased roadmap to make the Flowti Plugin a fully managed CLI project.

---

## Part 1: Architecture Review

### 1.1 Scale (as of 2026-03-12)

| Metric | Count |
|--------|-------|
| Source files | 343 |
| Test files | 238 |
| Tests | 3,742 |
| Test suites | 232 |
| Controllers | 22 |
| Domain modules | 25 |
| Infrastructure modules | 33 |
| UI files | 71 |
| Scaffold definitions | 4 |
| Entity types in registry | 22 |
| ESLint errors | 0 |
| ESLint warnings | 0 |
| Production dependencies | 0 |

### 1.2 Architectural Strengths

**1. Strict Layering (A+)**
The four-layer architecture (Infrastructure → Domain → Controller → UI) is consistently enforced via ESLint rules. No domain imports infrastructure singletons. No cross-domain imports. Controllers never call `log()` directly. The dependency rule is clean and testable.

**2. Dependency Injection (A)**
`CliDeps` with ISP subsets (`ReportDeps`, `E2EDeps`, `MakeDeps`) provides exactly the right interface to each domain function. Every test can mock precisely what it needs. The `createDefaultDeps()` factory and `adapt()` bridge keep the composition root in `main.ts`.

**3. MVC Request/Response (A)**
The `CliRequest → ControllerAction → CliResponse<T>` pattern with `dataResponse(model, renderer)` is clean and consistent across all 22 controllers. Dual-format output (JSON for agents, ANSI for humans) works seamlessly.

**4. Pipeline Engine (A)**
The generic pipeline engine supports linear and phased (DAG) execution with prerequisite deduplication, per-step error isolation, and structured logging. Used by reports, E2E, builds, and docs — a genuine reusable backbone.

**5. Store Pattern (A-)**
The 7 project management domains (resources, timelog, deliverables, RAID, requirements, CAPA, lifecycle) all follow the same pattern: `*-store.ts` + `*-types.ts`, pure functions with injected deps, markdown files with YAML frontmatter. Adding new management domains is mechanical.

**6. Configuration-Driven (A)**
`ProjectConfig` is the single contract. Features activate via config. Menus enable/disable based on config. The auto-scaffold from `package.json` means zero config to start.

**7. Zero Dependencies (A+)**
The built binary is self-contained. No runtime dependencies at all. The esbuild bundle inlines everything. This is a rare achievement for a CLI of this scope.

### 1.3 Architectural Concerns

**1. types.ts Size (Medium)**
At 325+ lines, `types.ts` is a growing cross-cutting file. Every new domain adds types here. The `max-lines` warning was resolved by raising the threshold to 350, but the trajectory is upward. Consider splitting into `types/project-config.ts`, `types/lifecycle.ts`, `types/management.ts`.

**2. E2E Domain Size (Medium)**
The E2E domain has 35 files across 4 subdirectories (root, journey/, pipelines/, steps/). It's the largest domain by far. The journey executor has providers for CLI, Obsidian, TypeScript, and webapp — each with distinct execution models. This will grow further when the Plugin's 8,000 LOC of E2E infrastructure migrates in (TD-23).

**3. Report Domain Complexity (Low)**
The reports domain has 40+ files across 4 subdirectories. This is inherent complexity — 14 generators with distinct inputs. The `ReportService` pattern keeps it manageable, but the sheer file count makes navigation harder.

**4. config.ts Singleton Tension (Low)**
`config.ts` exports singletons (`VAULT_ROOT`, `CLI_PROJECT`, `PROJECTS_DIR`) resolved at module load time. This works because the CLI runs as a single process, but it creates a tension with the otherwise clean DI pattern. Tests mock at the import level.

**5. Incomplete Domain Facades (Low)**
Some domains have explicit facade files (e.g., `ai-tools.ts`, `plugins.ts`) while others expose their store directly. Not a problem, but inconsistent.

### 1.4 Test Quality Assessment

| Aspect | Status |
|--------|--------|
| Coverage | 78.57% statements (target: 80%) |
| Test isolation | Fork-based (Vitest), mock abstractions for all I/O |
| Test structure | Mirrors src/ hierarchy perfectly |
| Mock quality | Typed mocks for IFileSystem, IShell, IProcess, IClock |
| E2E coverage | 5 journey tests with test vault isolation |
| Edge cases | Good — error paths, empty states, boundary values |

**Gap**: Statement coverage at 78.57% is slightly below the 80% target. The new management domains (lifecycle, CAPA, resources, etc.) likely have strong unit coverage but the recently extracted helpers may need additional edge case tests.

---

## Part 2: Fit-Gap Analysis — CLI vs Plugin

### 2.1 What the CLI Already Has

| Capability | CLI Status | Plugin Needs |
|------------|-----------|--------------|
| Project discovery & selection | Done | N/A — Plugin IS a project |
| Config schema (`ProjectConfig`) | Done — `build.commands{}`, `test.commands{}`, `devtools.commands{}` | Match (Plugin already uses named commands) |
| Build modes (fast/full/watch/distribute) | Done | Match (Plugin has 5 build modes) |
| Test presets (unit/flows/e2e) | Done | Match (Plugin has unit/flows/e2e) |
| Report pipeline (phased, resilient) | Done | Plugin has 14 script-based generators |
| E2E journey framework | Done (5 providers) | Plugin needs Obsidian provider |
| Health dashboard | Done | Compatible |
| Publish pipeline | Done | Plugin has distribute/release modes |
| Event catalog | Done (markdown-based) | Plugin has 406 event types (FlowtiEventMap) |
| Component system (C4) | Done | Plugin doesn't use components |
| Scaffold definitions | Done (4 types) | Plugin has `flowti-obsidian-plugin` scaffold |
| Resource management | Done | Not yet used by Plugin |
| Requirements management | Done | Not yet used by Plugin |
| Lifecycle engine | Done | Plugin could track feature lifecycles |
| Configurable lint thresholds | Done | Plugin can adopt same pattern |

### 2.2 What's Missing for Plugin Ingestion

| Gap | Severity | Description | Effort |
|-----|----------|-------------|--------|
| **G-01: Report script execution** | Critical | Plugin's 14 generators are npm scripts (`node scripts/generate-*.mjs`), not built-in `GeneratorFn` functions. CLI needs `reports.generators[].command` support for external scripts. | M (4h) |
| **G-02: CSS build step** | High | Plugin build includes CSS concatenation (12 layered files → `styles.css`). CLI's build wrapper doesn't know about multi-step builds. | S (2h) — Plugin's esbuild config handles this; CLI just runs the command |
| **G-03: Plugin distribution** | High | Plugin publish copies `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/flowti-ibde/`. CLI's publish pipeline needs to support Obsidian plugin output format. | M (4h) |
| **G-04: Event catalog scale** | Medium | Plugin has 406 event types in a TypeScript `FlowtiEventMap`. CLI's event catalog is markdown-file-based. Need an import/sync mechanism. | L (8h) |
| **G-05: E2E Obsidian provider** | Medium | Plugin's E2E tests need a running Obsidian instance. CLI has 5 journey providers but no Obsidian provider. (TD-23) | XL (16h) |
| **G-06: Test vault with Obsidian** | Medium | Plugin E2E creates test vaults that need Obsidian to be running. CLI's test vault is filesystem-only. | L (8h) |
| **G-07: Multi-step build pipeline** | Low | Plugin build is: `test:flows` → `esbuild` → `copy to output`. CLI's build is single-command. Pipeline engine could orchestrate this. | M (4h) |
| **G-08: Plugin-specific devtools** | Low | Plugin has `reload`, `console`, `errors`, `fixFrontmatter`, `testdata` devtools. CLI's devtools menu would need to surface these. | S (2h) — already supported via `devtools.commands{}` |
| **G-09: flowti.config.json migration** | Low | Plugin's current config uses a flat format that's mostly compatible but has minor differences (`reports.scripts[]` vs `reports.generators[]`). | S (2h) |
| **G-10: Coverage threshold gap** | Low | CLI target is 80%; Plugin has different thresholds. Need per-project threshold configuration. | Done — `reports.thresholds` already supports this |

### 2.3 What's Already Compatible (No Work Needed)

- `build.commands{}` — Plugin already maps 5 build modes, CLI supports arbitrary named commands
- `test.commands{}` — Plugin maps unit/flows/e2e, CLI supports arbitrary test presets
- `devtools.commands{}` — Plugin maps 7 devtools, CLI renders all as menu items
- `publish.endpoints[]` — Plugin has distribution endpoints, CLI's publish pipeline handles this
- `review.journeysDir` — Plugin has `tests/e2e/journeys/`, CLI reads from this path
- `health.thresholds` — Both use coverage/lint/test thresholds
- `devtools.thresholds` — Configurable lint limits (maxComplexity, maxLines)

---

## Part 3: Plugin Ingestion Roadmap

### Phase 1: Config Alignment (4h)

**Goal**: Plugin's `flowti.config.json` conforms to CLI's `ProjectConfig` schema.

| Step | Description | Effort |
|------|-------------|--------|
| 1.1 | Add `reports.generators[].command` support to `GeneratorFn` resolver — when a generator has `command` instead of `id`, run it as a shell command | 2h |
| 1.2 | Rewrite Plugin's `flowti.config.json` to use CLI schema (`build.commands`, `test.commands`, `reports.generators[]` with `command` field) | 1h |
| 1.3 | Validate Plugin config loads cleanly via `readProjectConfig()` + `validateProjectConfig()` | 1h |

**Verification**: `flowti info --project="Flowti Plugin"` shows correct config.

### Phase 2: Build & Publish Integration (6h)

**Goal**: CLI can build and publish the Plugin end-to-end.

| Step | Description | Effort |
|------|-------------|--------|
| 2.1 | Verify `flowti build --project="Flowti Plugin"` runs Plugin's build modes (fast/full/watch) | 1h |
| 2.2 | Add Obsidian plugin publish support — copy `main.js`, `manifest.json`, `styles.css` to `pluginOutput` | 3h |
| 2.3 | Test `flowti publish --project="Flowti Plugin"` end-to-end | 2h |

**Verification**: `flowti publish --project="Flowti Plugin"` builds, tests, and copies to `.obsidian/plugins/flowti-ibde/`.

### Phase 3: Report Ingestion (6h)

**Goal**: CLI generates all 14 of the Plugin's reports.

| Step | Description | Effort |
|------|-------------|--------|
| 3.1 | Implement external script generator (`reports.generators[].command`) — run script, capture output path, feed to report service | 4h |
| 3.2 | Configure Plugin's 14 generators as `command`-based entries in `reports.generators[]` | 1h |
| 3.3 | Verify `flowti reports --project="Flowti Plugin"` runs all 14 generators | 1h |

**Verification**: `flowti reports --project="Flowti Plugin"` produces all reports with summary.

### Phase 4: Health & Quality Baselines (4h)

**Goal**: Plugin has a health dashboard and quality gates.

| Step | Description | Effort |
|------|-------------|--------|
| 4.1 | Configure `health.thresholds` in Plugin's config (coverage, lint, test minimums) | 1h |
| 4.2 | Run `flowti health --project="Flowti Plugin"` and establish baselines | 1h |
| 4.3 | Configure `publish` quality gates (min score, lint limits) | 1h |
| 4.4 | Run health trend snapshots to establish initial trend data | 1h |

**Verification**: `flowti health --project="Flowti Plugin"` shows score with trend.

### Phase 5: Event Catalog Sync (8h)

**Goal**: Plugin's 406 event types are browsable and queryable via CLI.

| Step | Description | Effort |
|------|-------------|--------|
| 5.1 | Create event catalog import — parse `FlowtiEventMap` TypeScript and generate markdown event files | 6h |
| 5.2 | Add `events:sync` command that re-runs the import when the event map changes | 2h |

**Verification**: `flowti events:list --project="Flowti Plugin"` shows all 406 events.

### Phase 6: E2E Migration (24h)

**Goal**: CLI can run Plugin's E2E journeys.

| Step | Description | Effort |
|------|-------------|--------|
| 6.1 | Create Obsidian journey provider — launches Obsidian, waits for ready, executes tool actions | 12h |
| 6.2 | Migrate Plugin's ObsidianCli and test helpers to CLI E2E domain | 8h |
| 6.3 | Port Plugin's 9 journeys to CLI journey format | 4h |

**Verification**: `flowti review --project="Flowti Plugin"` runs E2E journeys with test vault.

### Phase 7: Project Management Adoption (2h)

**Goal**: Plugin uses CLI's management domains.

| Step | Description | Effort |
|------|-------------|--------|
| 7.1 | Configure `management.*` directories in Plugin config | 0.5h |
| 7.2 | Seed initial requirements from Plugin's existing PRD | 1h |
| 7.3 | Create initial lifecycle entry for the Plugin product | 0.5h |

**Verification**: `flowti requirements:list --project="Flowti Plugin"` shows requirements.

---

### Roadmap Summary

| Phase | Effort | Depends On | Unlocks |
|-------|--------|------------|---------|
| 1. Config Alignment | 4h | — | All other phases |
| 2. Build & Publish | 6h | Phase 1 | Plugin builds and distributes via CLI |
| 3. Report Ingestion | 6h | Phase 1 | Plugin reports via CLI pipeline |
| 4. Health & Quality | 4h | Phase 3 | Quality gates for publish |
| 5. Event Catalog Sync | 8h | Phase 1 | Event browsing and documentation |
| 6. E2E Migration | 24h | Phase 2 | Full review/test cycle via CLI |
| 7. Management Adoption | 2h | Phase 1 | Requirements, lifecycle, RAID tracking |
| **Total** | **54h** | | |

**Critical path**: Phase 1 → Phase 2 → Phase 6 (34h for build-test-publish coverage)

**Quick wins**: Phase 1 + 2 + 4 (14h) gives build, publish, and health — immediate value.

---

## Part 4: Recommended Next Steps

### Immediate (this cycle)

1. **Phase 1.1**: Add `reports.generators[].command` support — the single highest-impact change. Unblocks Phases 2–4.
2. **Phase 1.2**: Rewrite Plugin's `flowti.config.json` — 1 hour, no CLI code changes.
3. **Statement coverage**: Bring from 78.57% to 80% target — add tests for newly extracted helpers in resource-store.ts and the new lifecycle domain.

### Near-term (next 2 cycles)

4. **Phases 2–4**: Build, publish, reports, health for the Plugin. 16h total, highest ROI.
5. **TD-01 resolution**: The Config Schema Mismatch (critical tech debt) is largely resolved by the current `build.commands{}` / `test.commands{}` pattern. Close this item.

### Medium-term (3–5 cycles)

6. **Phase 5**: Event catalog sync. Important for documentation, not blocking for builds.
7. **Phase 6**: E2E migration. The largest effort but deferred because Plugin E2E currently works independently.

### Deferred

8. **Phase 7**: Management adoption. Low urgency — purely additive value, no migration required.
9. **types.ts split**: Only when it crosses 400 lines.
10. **E2E domain refactor (TD-07)**: Split generic framework from CLI-specific execution logic before Phase 6 migration.
