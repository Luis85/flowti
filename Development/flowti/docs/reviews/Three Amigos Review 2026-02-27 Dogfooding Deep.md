---
type: ThreeAmigosReview
date: 2026-02-27
feature: "[[Backlog Refinement - Post Cycle 48]]"
scope: Cycle 51 delivery (Dogfooding Deep — Auto-generation pipeline + Traceability + TD-90 resolution)
verdict: pass
participants:
  - Business (Product Owner)
  - Development (Technical Architect)
  - QA (Test Lead)
tags:
  - review
  - dogfooding
  - auto-generation
  - traceability
---

# Three Amigos Review: Dogfooding Deep — Cycle 51 Delivery

**Date:** 2026-02-27
**Scope:** Cycle 51 complete — Cycle report auto-generation, traceability conformance checker + link enricher, command reference auto-generation, event catalog auto-generation (336 events), data dictionary auto-generation (18 types, 131 fields), TD-90 resolution
**Previous Review:** Cycle 50 (PASS, User Activation, 8 increments)
**Current State:** 5,643 tests (243 suites), 5/5 increments delivered, 3 PBIs + 1 TD resolved

---

## Verdict: PASS

All three perspectives agree: Cycle 51 delivers the **self-documenting development engine** that proves Flowti can manage its own lifecycle. The build pipeline now auto-generates 5 document types from TypeScript source code — cycle reports, trace conformance reports, command references, event catalogs, and data dictionaries. Manual documentation drift is eliminated for the two highest-maintenance documents (Event Catalog, Data Dictionary). The traceability conformance checker provides a living gap analysis of vault document connectivity. All 5 increments delivered independently with zero coupling issues, 94 new tests (exceeding the 70 estimate by 34%), and a clean production build.

---

## Business Perspective (Product Owner)

### Delivered Value Assessment

| Metric | Value |
|--------|-------|
| PBIs delivered | 3/3 (PBI-DOG-001, PBI-DOG-002, PBI-DOG-003) |
| Tech debt resolved | 1 (TD-90) |
| Auto-generated documents | 5 (cycle report, trace report, command reference, event catalog, data dictionary) |
| Manual documents replaced | 2 (Event Catalog 598 lines, Data Dictionary 541 lines) |
| Traceability gaps identified | 367 across 616 documents (40.42% coverage) |

### Value Highlights

1. **TD-90 fully resolved** — The two highest-maintenance manual documents (Event Catalog: 598 lines, Data Dictionary: 541 lines) are now auto-generated from TypeScript source on every production build. Drift between code and documentation is structurally impossible.
2. **Build pipeline is now a documentation engine** — 9 generation scripts produce reports and references covering tests, coverage, codebase metrics, build artifacts, cycle summaries, traceability gaps, commands, events, and entity types. The development process documents itself.
3. **Traceability conformance provides actionable data** — 367 gaps identified across 616 vault documents. The 321 unlinked inbox items and 44 resolved tech debt items without `resolved_in` are now visible and actionable. Obsidian's graph view will improve as these gaps are closed.
4. **Cycle reports with wikilinks create a connected knowledge graph** — Each cycle report links to its source cycle document, PBIs, tech debt items, and related test/coverage/codebase reports. Obsidian's graph view reveals the full delivery chain.
5. **Entity type registry enables downstream automation** — The `ENTITY_TYPE_REGISTRY` (18 types, 131 fields) created for the data dictionary is reusable for TD-78 (domain documentation auto-generation) and runtime schema validation.

### Concerns

- **CON-1**: Traceability enricher is dry-run only — it identifies what links could be added but doesn't apply them. The `--apply` mode would close gaps automatically. Low priority since data quality awareness is the primary goal.

---

## Development Perspective (Technical Architect)

### Architecture Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Pure function architecture | Excellent | All generators are pure TS functions in `src/domain/docs/`. No side effects, no service dependencies, fully testable in isolation. |
| Script pattern consistency | Excellent | All 5 new scripts follow the established pattern: read source → regex extract → build frontmatter → generate markdown → write file. |
| Regex-based TS parsing | Good | Reliable for structured, single-line-per-entry formats (catalog.ts, registry.ts). Brace-counting approach for entityTypeRegistry.ts handles nested arrays. Monitor for fragility if source formats change. |
| Entity type registry | Excellent | 365 LOC, 18 types, 131 fields. Centralized source of truth. Well-structured for downstream consumption (TD-78, runtime validation). |
| Build pipeline integration | Excellent | 9 scripts in sequence, ~2s additional build time. Clean error handling — script failures are logged and skipped, never break the build. |
| Report vs Reference taxonomy | Good | Clear distinction: reports get ISO timestamps (time-series), references get stable names (current state of truth). Convention is clean and should be documented. |

### Technical Observations

- **OBS-1: Entity type registry is the highest-value artifact.** At 365 LOC with 18 entity type definitions, it serves as the single source of truth for all document type metadata. It enables TD-78 (domain docs auto-generation), runtime schema validation, and UI-driven type browsing. The investment ratio (365 LOC input → 3 downstream use cases) is excellent.
- **OBS-2: Regex parsing is a conscious trade-off.** Parsing TypeScript source with regex avoids ESM/CJS/tsx complexity but creates implicit coupling to source file formatting. If `catalog.ts` or `entityTypeRegistry.ts` change their formatting conventions, the regex may break. Mitigation: the build will warn (not fail) if extraction returns zero results.
- **OBS-3: No new runtime events or services.** All 5 increments are build-time-only additions. Zero changes to the plugin's runtime behavior. This is the ideal profile for a dogfooding cycle — infrastructure that improves the development process without touching production code paths.
- **OBS-4: `src/domain/docs/` is growing.** Now 8 files: `reportParser.ts`, `traceTypes.ts`, `traceConformanceChecker.ts`, `traceLinkEnricher.ts`, `commandReferenceGenerator.ts`, `eventCatalogGenerator.ts`, `entityTypeRegistry.ts`, `dataDictionaryGenerator.ts`. All are pure functions with clean boundaries. No extraction needed yet, but monitor if the module count doubles.

### TASM Scores

| Inc | Alignment | Quality | Completeness | TASM |
|-----|-----------|---------|--------------|------|
| 1 (Cycle Report) | 7/7 | 7/7 | 7/7 | 21/21 |
| 2 (Traceability) | 7/7 | 7/7 | 6/7 | 20/21 |
| 3 (Command Reference) | 7/7 | 7/7 | 7/7 | 21/21 |
| 4 (Event Catalog) | 7/7 | 7/7 | 7/7 | 21/21 |
| 5 (Data Dictionary) | 7/7 | 7/7 | 7/7 | 21/21 |
| **Avg** | | | | **20.8/21 (34.7/35)** |

Inc 2 completeness: enricher is dry-run only; no `--apply` mode. Functional for auditing, but link application requires manual review or future automation.

---

## QA Perspective (Test Lead)

### Test Coverage Assessment

| Category | Tests | Coverage |
|----------|-------|----------|
| reportParser.cycle unit tests | 22 | Frontmatter parsing (complete, partial, defaults), delta calculations, wikilink context (source doc, PBIs, debt, report links), markdown generation |
| traceConformanceChecker unit tests | 17 | Gap detection for all 4 document types (inbox, PBI, cycle, tech debt), empty vault, zero gaps, coverage calculation |
| traceLinkEnricher unit tests | 9 | Additive enrichment for `planned_in` and `resolved_in`, skip-when-exists, deterministic only |
| commandReferenceGenerator unit tests | 13 | Grouping by domain, alphabetical sort, markdown tables, empty domains, missing shortcuts/icons, frontmatter counts |
| eventCatalogGenerator unit tests | 17 | Category grouping, display order, domain summary, phantom detection, stability/visibility, system tags, full end-to-end |
| dataDictionaryGenerator unit tests | 16 | Group-by-group, field tables, required indicators, entity metadata, group labels, empty input, multi-entity groups |
| **Total new** | **94** | |
| Existing tests (regression) | 5,549 | All passing, 0 regressions |
| **Post-cycle total** | **5,643** | 243 suites |

### Quality Observations

- **QO-1: Test estimates exceeded by 34%** — 94 actual vs 70 estimated. The excess came from richer conformance checking scenarios (17 vs ~10 estimated) and wikilink context tests for cycle reports (22 vs 15 estimated). Both areas warranted the additional coverage.
- **QO-2: All generators are pure functions** — every test runs without mocks, file system access, or external dependencies. Test execution is sub-10ms per suite. This is the gold standard for testability.
- **QO-3: No test regressions** — all 5,549 pre-existing tests pass unchanged. Zero test files modified. Zero skipped tests introduced.
- **QO-4: Build pipeline tested end-to-end** — `npm run build` executed successfully with all 9 generation scripts producing valid output. Real vault scan extracted 336 events and 18 entity types from source.
- **QO-5: Conformance checker provides baseline metrics** — 367 gaps / 616 documents = 40.42% coverage. This provides a measurable baseline for future traceability improvement.

### Regression Risk: VERY LOW

- All changes are build-time additions (new scripts, new pure functions, new tests)
- Zero modifications to existing production code or runtime behavior
- Zero modifications to existing test files
- The only modified existing files are `esbuild.config.mjs` (added script paths), `package.json` (extended generate:reports command), and `eslint.config.mjs` (added scripts/ to ignores)

---

## Action Items

| ID | Action | Owner | Priority |
|----|--------|-------|----------|
| AI-1 | Implement `--apply` mode for trace link enricher | Dev | Low — dry-run mode provides audit capability |
| AI-2 | Document report vs reference naming convention in pipeline docs | Dev | Low — convention is clear in code |
| AI-3 | Monitor `src/domain/docs/` module count — consider grouping if it doubles | Dev | Low — monitor |
| AI-4 | Review 321 unlinked inbox items during next inbox triage | Process | Medium — data quality improvement |
| AI-5 | Leverage entity type registry for TD-78 (domain docs auto-generation) | Dev | Medium — scheduled for C55 stretch |

---

## Metrics Summary

| Metric | Pre-Cycle | Post-Cycle | Delta |
|--------|-----------|------------|-------|
| Tests | 5,549 | 5,643 | +94 |
| Test suites | 237 | 243 | +6 |
| Auto-generated docs | 4 (reports only) | 9 (4 reports + 3 references + 2 new reports) | +5 |
| Manual reference docs | 2 (Event Catalog, Data Dictionary) | 0 | -2 |
| Generation scripts | 4 | 9 | +5 |
| Entity types in registry | 0 | 18 | +18 |
| Events in catalog (extracted) | — | 336 | — |
| Traceability coverage | Unknown | 40.42% (367 gaps / 616 docs) | Baseline established |
| Tech debt resolved | — | TD-90 | — |
| TASM average | — | 34.7/35 | — |

---

## Related

- [[Cycle 51 - Dogfooding Deep]]
- [[Backlog Refinement - Post Cycle 48]]
- [[TD-90 Event Catalog and Data Dictionary are manually maintained]]
