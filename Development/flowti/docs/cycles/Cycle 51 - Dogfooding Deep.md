---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: planning
cycle: 51
release_anchor:
  - "Theme 2: Dogfooding — Flowti Builds Flowti"
pbis:
  - "PBI-DOG-001: Auto-generate cycle reports"
  - "PBI-DOG-002: Idea-to-solution traceability"
  - "PBI-DOG-003: Auto-document commands"
  - "TD-90: Event Catalog auto-generation"
bugs: []
tech_debt:
  - TD-90
estimated_increments: 5
estimated_tests: 70
pre_cycle_tests: 5549
pre_cycle_suites: 237
---

# Cycle 51 — Dogfooding Deep

## Release Anchor Theme

- **Theme 2: Dogfooding — Flowti Builds Flowti** — Prove the product by using it. Every gap discovered is a gap users would hit.

## Situation Assessment

### Codebase Health
- **Production LOC**: ~26,000+ across 11 domain services
- **Tests**: 5,549 passing (237 suites), 0 failures
- **Build**: `npm run build` green
- **Lint**: `npm run check` → 0 errors, 0 warnings
- **Previous cycle**: C50 closed (stage: `done`, 2026-02-27), 8 increments delivered (7 planned + 1 unplanned), 97 tests added, TASM 32/35

### Dogfooding Domain Maturity
- **Report pipeline**: 4 report types (Test, Coverage, Build, Codebase) auto-generated via `scripts/generate-*-report.mjs` (C49)
- **CommandRegistry**: Extended with `CommandMeta` and `getCommandsByDomain()` (C50) — 40+ commands cataloged
- **Event Catalog source**: `catalog.ts` (78 KB) with `satisfies` compile-time verification, 159 events across 38 categories
- **Data Dictionary doc**: 541 lines, 16+ document types, manually maintained
- **Inbox items**: 149 total (85 vault + 64 plugin) — no traceability links to delivered features

### Infrastructure Available
- **Report pattern**: Scripts read input JSON → build YAML frontmatter → generate timestamped markdown. `yamlEscape()` helper for safe serialization.
- **EventCatalogMeta**: Runtime metadata per event (category, description, direction, domain, services, stability, visibility, tags)
- **Per-domain EventMap**: 11 domain `events.ts` files exporting typed interfaces, composed via `extends`
- **FlowtiSettingsSchema**: Zod schema with 40+ fields, `z.infer<>` for type derivation, `safeParse()` for validation

### Open Issues
- TD-90: Event Catalog + Data Dictionary manually maintained (medium severity, large effort)
- No critical bugs open
- No release blockers targeting C51

## Cycle Overview

Cycle 51 turns the development process into Flowti's primary testbed. If Flowti can't manage its own development lifecycle — auto-generating cycle reports, keeping its event catalog current from source, and ensuring vault documents are well-connected enough for Obsidian's graph to reveal the full idea-to-delivery chain — it can't do it for anyone else.

The key principle: **Flowti owns data quality, Obsidian owns visualization.** Rather than building custom graph views, we ensure vault documents have proper frontmatter links so Obsidian's native graph view works out of the box. This cycle builds on the report ingestion infrastructure from C49 and the Command Catalog from C50 to create a self-documenting, self-tracking development engine.

## User Pains

1. **Cycle reports are manually written** — After every cycle, metrics are hand-copied into documents. This is error-prone and time-consuming.
2. **Poor traceability from idea to delivered feature** — 149 inbox items exist but many lack `parent` links to PRDs/PBIs. PBIs lack `planned_in`/`delivered_in` links to cycles. Obsidian's graph view could visualize the full chain, but the data isn't connected enough.
3. **Command documentation is separate from code** — Commands are registered in TypeScript but documented in markdown. They drift.
4. **Event Catalog is manually maintained** — 159 events, manually kept current. 9 phantom events found in PRD audit (TD-90). Data Dictionary (541 lines) also manual.

## Cycle Goals

1. **Auto-generate cycle reports** from cycle document frontmatter and git metadata
2. **Ensure traceability data quality** — audit and enrich vault documents so Obsidian's graph view reveals the full idea → PBI → cycle → delivery chain
3. **Auto-document commands** from CommandRegistry metadata (built in C50)
4. **Auto-generate Event Catalog and Data Dictionary** from TypeScript source (TD-90)

## Scope

### In Scope
- PBI-DOG-001: Cycle report auto-generation (cycle frontmatter → structured report note)
- PBI-DOG-002: Traceability data quality — conformance checker + link enricher (Obsidian graph handles visualization)
- PBI-DOG-003: Command reference auto-generation from CommandRegistry
- TD-90: Event Catalog generation from `catalog.ts` + Data Dictionary generation from schema definitions

### Out of Scope
- AI-assisted report generation (manual template + auto-fill only)
- Custom traceability graph visualization (Obsidian graph view handles this natively)
- Analytics Hub integration for traceability queries (deferred — data quality first)
- Documentation hosting or publishing (vault-only)
- Git history visualization (timeline views deferred)
- Cross-referencing Data Dictionary ↔ Event Catalog (deferred — convention-based links only)

## PBI Backlog

| # | PBI | Title | Priority | INVEST |
|---|-----|-------|----------|--------|
| 1 | PBI-DOG-001 | Auto-generate cycle reports | High | Sized (Medium), Testable, Valuable, Independent |
| 2 | PBI-DOG-002 | Traceability data quality (conformance checker + link enricher) | High | Sized (Medium), Testable, Estimable |
| 3 | PBI-DOG-003 | Auto-document commands from registry | Medium | Sized (Small), Testable, Independent |
| 4 | TD-90 | Event Catalog + Data Dictionary auto-generation | High | Sized (Large+Medium), Testable, Valuable |

## Increments

### Inc 1: Cycle Report Auto-Generation (PBI-DOG-001)
**Theme**: Dogfooding
**Effort**: Medium
**Estimate**: +120 LOC production, +80 LOC test, ~15 tests

Auto-generate a cycle report note from cycle document frontmatter:
- New script `scripts/generate-cycle-report.mjs` following established report pattern
- Parse cycle document frontmatter: `cycle`, `stage`, `actual_increments`, `actual_tests`, `pre_cycle_tests`, `total_tests_after`, `pbis`, `tech_debt`, `date_planned`, `date_completed`
- Calculate delta metrics: tests added (`total_tests_after - pre_cycle_tests`), suite delta, PBI count, debt items resolved
- Generate structured markdown report note in `docs/reports/cycles/`
- Frontmatter: `type: CycleReport`, `cycle`, `tests_added`, `total_tests`, `increments`, `pbis_delivered`, `debt_resolved`, `tasm_score`
- Body: cycle summary, PBI table, increment list, metrics table
- Wire into `npm run generate:reports` and post-build hook

**Acceptance Criteria**:
- [ ] Report note auto-generated from cycle document frontmatter
- [ ] Frontmatter contains queryable metrics (cycle, tests_added, increments, pbis_delivered, debt_resolved)
- [ ] PBI summary table in report body
- [ ] Report stored in `docs/reports/cycles/Cycle {N} Report.md`
- [ ] Wired into `npm run generate:reports`
- [ ] Unit tests for report generation logic
- [ ] `npm test` green

**Test Intent**: ~15 tests covering: frontmatter parsing (complete and partial), delta calculations (tests added, suites delta), report markdown generation (frontmatter + body), edge cases (missing fields, zero deltas), PBI table generation, file naming convention.

**Documentation Intent**: Add cycle report format to report pipeline documentation. Update TD-87 knowledge base if relevant.

**Architecture Seams**:
- New script `scripts/generate-cycle-report.mjs` — follows `generate-test-report.mjs` pattern (read input → parse → build frontmatter → write markdown)
- Input: cycle document path (latest cycle with `stage: done`) resolved from `docs/cycles/`
- Output: `docs/reports/cycles/Cycle {N} Report.md` — overwrites on each generation
- `CycleReportFrontmatter` interface added to `src/domain/docs/reportParser.ts`
- `parseCycleFrontmatter()` pure function in `reportParser.ts`
- Build integration: added to `postBuild()` in `esbuild.config.mjs` after existing report steps

**Files**:
- New: `scripts/generate-cycle-report.mjs` (~80 LOC)
- Modified: `src/domain/docs/reportParser.ts` (~40 LOC — new interface + parser)
- Modified: `esbuild.config.mjs` (~5 LOC — add to postBuild)
- Modified: `package.json` (~2 LOC — add to generate:reports script)
- New: `tests/domain/docs/reportParser.cycle.test.ts` (~80 LOC)

### Inc 2: Traceability Data Quality (PBI-DOG-002)
**Theme**: Dogfooding
**Effort**: Medium
**Estimate**: +140 LOC production, +100 LOC test, ~18 tests

Ensure vault documents are properly connected so Obsidian's native graph view reveals the full idea-to-delivery chain. Flowti owns data quality; Obsidian owns visualization.

**Two components:**

**TraceConformanceChecker** — audits documents for missing traceability links:
- Scan inbox items: expect `parent` wikilink to PRD or PBI
- Scan PBI docs: expect `source` wikilink to inbox item, `planned_in` or `delivered_in` to cycle
- Scan cycle docs: expect `pbis` array with valid PBI references, `feature` link to PRD
- Scan PRD docs: expect backlog table with PBI links, stage history with cycle references
- Scan tech debt docs: expect `resolved_in` for resolved items
- Output: `TraceConformanceReport` — lists gaps by category (orphaned PBIs, unlinked inbox items, cycles without PBI refs, etc.)

**TraceLinkEnricher** — auto-adds missing frontmatter properties where deterministic:
- If a cycle's `pbis` array references a PBI that lacks `planned_in`, add `planned_in: "Cycle N"`
- If an inbox item has `delivered_in` but no `parent` link, flag as manual review needed
- If a tech debt item is referenced in a cycle's `tech_debt` array and has `status: resolved` but no `resolved_in`, add `resolved_in: "Cycle N"`
- Enrichment is additive only (never removes existing properties)
- Dry-run mode: report what would change without writing

**Generated report**: `docs/reports/traceability/Trace Conformance Report.md`
- Frontmatter: `type: TraceConformanceReport`, `date`, `documents_scanned`, `gaps_found`, `links_enriched`
- Body: gap table by category, enrichment summary, coverage percentage

**Acceptance Criteria**:
- [ ] ConformanceChecker scans inbox, PBI, cycle, PRD, and tech debt documents
- [ ] Gap detection identifies: orphaned PBIs, unlinked inbox items, cycles without PBI refs, resolved debt without `resolved_in`
- [ ] LinkEnricher adds `planned_in`, `delivered_in`, `resolved_in` where deterministic
- [ ] Enrichment is additive-only (never removes properties)
- [ ] Dry-run mode reports changes without writing
- [ ] Conformance report generated with gap table and coverage stats
- [ ] New script `scripts/generate-trace-report.mjs` wired into `npm run generate:reports`
- [ ] Unit tests for conformance checking and enrichment logic
- [ ] `npm test` green

**Test Intent**: ~18 tests covering: gap detection for orphaned PBI (no parent link), gap detection for unlinked inbox item (no parent), gap detection for cycle without PBI refs, gap detection for resolved TD without `resolved_in`, enrichment adds `planned_in` from cycle's pbis array, enrichment adds `resolved_in` from cycle's tech_debt array, enrichment skips when property already exists (additive-only), dry-run mode returns changes without writing, conformance report frontmatter generation, conformance report gap table formatting, empty vault (no gaps), coverage percentage calculation.

**Documentation Intent**: The conformance report IS the documentation — a living gap analysis that improves with each cycle. Future cycles run the checker to verify traceability coverage.

**Architecture Seams**:
- New: `src/domain/docs/traceConformanceChecker.ts` — pure functions, takes document metadata arrays, returns `TraceConformanceReport`
- New: `src/domain/docs/traceLinkEnricher.ts` — pure functions, takes document metadata + conformance report, returns enrichment actions
- Types: `TraceGap { documentId, documentType, gapType, description }`, `EnrichmentAction { documentId, property, value, reason }`
- No new domain folder needed — lives in `src/domain/docs/` alongside existing report generators
- No new events — runs as a build-time script only
- No service or runtime registration — pure functions called from Node script
- Consumes: raw frontmatter parsed from vault files (script reads via `fs.readFileSync`)
- Output: `docs/reports/traceability/Trace Conformance Report.md`

**Files**:
- New: `src/domain/docs/traceConformanceChecker.ts` (~70 LOC)
- New: `src/domain/docs/traceLinkEnricher.ts` (~40 LOC)
- New: `src/domain/docs/traceTypes.ts` (~20 LOC)
- New: `scripts/generate-trace-report.mjs` (~50 LOC)
- Modified: `esbuild.config.mjs` (~3 LOC — add to postBuild)
- Modified: `package.json` (~2 LOC — add to generate:reports)
- New: `tests/domain/docs/traceConformanceChecker.test.ts` (~60 LOC)
- New: `tests/domain/docs/traceLinkEnricher.test.ts` (~40 LOC)

### Inc 3: Command Reference Auto-Generation (PBI-DOG-003)
**Theme**: Dogfooding
**Effort**: Small
**Estimate**: +80 LOC production, +60 LOC test, ~12 tests

Auto-generate a command reference document from CommandRegistry metadata:
- New script `scripts/generate-command-reference.mjs`
- Read CommandMeta from a JSON snapshot (generated during build via a small esbuild plugin or pre-build step)
- Group by domain, alphabetical within groups
- Generate `docs/reference/Command Reference.md` with table: command label, description, domain, category, shortcut
- Frontmatter: `type: CommandReference`, `date`, `total_commands`, `domains`
- Wire into `npm run generate:reports`

**Acceptance Criteria**:
- [ ] Command Reference generated from registry metadata
- [ ] Grouped by domain with descriptions, categories, and shortcuts
- [ ] Regenerated on build
- [ ] Matches actual registered commands (no drift possible)
- [ ] Frontmatter with `total_commands` and `domains` count
- [ ] Unit tests for generation logic
- [ ] `npm test` green

**Test Intent**: ~12 tests covering: command grouping by domain, alphabetical sort within groups, markdown table generation (headers, rows, alignment), empty domain handling, commands without shortcuts, commands without icons, frontmatter generation with correct counts, full end-to-end generation with sample CommandMeta array.

**Documentation Intent**: The generated Command Reference IS the documentation. Replaces any manual command listings.

**Architecture Seams**:
- New script `scripts/generate-command-reference.mjs` — follows report pattern
- Input: JSON file with CommandMeta array, generated during build by `esbuild.config.mjs` plugin step that imports `CommandRegistry.getCommandsMeta()`
- Alternative: Script reads `src/infrastructure/commands/registry.ts` and parses the `COMMAND_META` constant (simpler, no build-time import needed)
- Output: `docs/reference/Command Reference.md` — overwrites on each generation
- `generateCommandReference(metas: CommandMeta[]): string` pure function in `src/domain/docs/commandReferenceGenerator.ts`

**Files**:
- New: `src/domain/docs/commandReferenceGenerator.ts` (~50 LOC — pure function)
- New: `scripts/generate-command-reference.mjs` (~30 LOC)
- Modified: `esbuild.config.mjs` (~5 LOC — add to postBuild)
- Modified: `package.json` (~2 LOC — add to generate:reports)
- New: `tests/domain/docs/commandReferenceGenerator.test.ts` (~60 LOC)

### Inc 4: Event Catalog Auto-Generation (TD-90a)
**Theme**: Dogfooding
**Effort**: Large
**Estimate**: +200 LOC production, +120 LOC test, ~18 tests

Auto-generate Event Catalog from the runtime `CATALOG_DATA` in `catalog.ts`:
- `EventCatalogGenerator` — pure function that takes `CATALOG_DATA` entries and produces structured markdown
- Group events by category (using `EVENT_CATEGORIES` display order from `catalog.ts`)
- For each event: name, domain, description, direction, services, stability, visibility, tags
- Generate domain summary table: domain → event count → service(s)
- Generate category sections with event tables
- Frontmatter: `type: EventCatalog`, `date`, `total_events`, `categories`, `domains`
- Phantom detection: compare generated event list against existing doc (report additions/removals)
- New script `scripts/generate-event-catalog.mjs` — reads catalog data, generates doc
- Wire into build pipeline

**Acceptance Criteria**:
- [ ] Event Catalog generated from `CATALOG_DATA` runtime metadata
- [ ] All 159 events documented with domain, description, direction, services
- [ ] Events grouped by category in display order
- [ ] Domain summary table with event counts
- [ ] Stability and visibility indicators included
- [ ] Phantom event detection (additions/removals vs previous version)
- [ ] Replaces manual `Event Catalog.md`
- [ ] Added to build pipeline
- [ ] Unit tests for generator and phantom detection
- [ ] `npm test` green

**Test Intent**: ~18 tests covering: single event generation (all fields), category grouping (events sorted into correct categories), category display order (matches `EVENT_CATEGORIES`), domain summary table (correct counts per domain), stability/visibility rendering, system tag handling, phantom detection (added event, removed event, unchanged), empty category handling, markdown table formatting, full end-to-end generation with sample catalog data.

**Documentation Intent**: The generated Event Catalog IS the documentation. Replaces the manual 598-line `Event Catalog.md`. TD-90 (Event Catalog half) resolved.

**Architecture Seams**:
- New: `src/domain/docs/eventCatalogGenerator.ts` — pure functions, no service dependencies
- Input: `EventCatalogMeta` entries (same type used in `catalog.ts`) — passed as array of `[eventName, meta]` tuples
- Uses `EVENT_CATEGORIES` constant for display ordering (imported from `catalog.ts`)
- `generateEventCatalog(entries, categories): string` — returns full markdown string
- `detectPhantomEvents(generated, existing): { added: string[], removed: string[] }` — compares event lists
- New script `scripts/generate-event-catalog.mjs` — imports `CATALOG_DATA` and `EVENT_CATEGORIES` from compiled bundle or directly from TS via `tsx`
- Output: `docs/reference/Event Catalog.md` (new location) or `docs/Event Catalog.md` (in-place replacement)
- Build integration: added to `postBuild()` after existing report steps

**Files**:
- New: `src/domain/docs/eventCatalogGenerator.ts` (~130 LOC)
- New: `scripts/generate-event-catalog.mjs` (~50 LOC)
- Modified: `esbuild.config.mjs` (~5 LOC — add to postBuild)
- Modified: `package.json` (~2 LOC)
- Modified: `src/infrastructure/events/catalog.ts` (~5 LOC — export `EVENT_CATEGORIES` if not already)
- New: `tests/domain/docs/eventCatalogGenerator.test.ts` (~120 LOC)

### Inc 5: Data Dictionary Auto-Generation (TD-90b)
**Theme**: Dogfooding
**Effort**: Medium
**Estimate**: +140 LOC production, +80 LOC test, ~12 tests

Auto-generate Data Dictionary from entity type definitions and frontmatter schema constants:
- `DataDictionaryGenerator` — pure function that takes entity type metadata and produces structured markdown
- Source: existing `ENTITY_SCHEMAS` / type definition constants in domain code (e.g., `EventDoc`, `DomainDoc`, `CsvDoc` schemas)
- For each entity type: type name, tab/view location, folder pattern, fields table (field, type, required, default, description)
- Frontmatter: `type: DataDictionary`, `date`, `total_types`, `total_fields`
- New script `scripts/generate-data-dictionary.mjs`
- Wire into build pipeline

**Acceptance Criteria**:
- [ ] Data Dictionary generated from schema/type definitions
- [ ] All 16+ document types documented with fields and constraints
- [ ] Field tables include: name, type, required flag, default value, description
- [ ] Entity types grouped by domain (Event Catalog types, Data Exchange types, Special types)
- [ ] Replaces manual `Data Dictionary.md`
- [ ] Added to build pipeline
- [ ] Unit tests for generator
- [ ] `npm test` green

**Test Intent**: ~12 tests covering: single entity type generation (all field types), field table formatting (required vs optional, with/without defaults), entity grouping by domain, markdown table correctness, frontmatter generation with counts, empty entity handling, nested object field rendering (e.g., Zod `z.object` within `z.object`), full end-to-end generation with sample schema metadata.

**Documentation Intent**: The generated Data Dictionary IS the documentation. Replaces the manual 541-line `Data Dictionary.md`. TD-90 (Data Dictionary half) resolved.

**Architecture Seams**:
- New: `src/domain/docs/dataDictionaryGenerator.ts` — pure functions
- Input: Array of `EntityTypeMeta` objects: `{ typeName, domain, folder, nameField, description, fields: FieldMeta[] }`
- `FieldMeta`: `{ name, type, required, default?, description? }`
- Source of metadata: extract from existing domain type files and Zod schemas. May require a `ENTITY_TYPE_REGISTRY` constant that aggregates all entity types — similar to how `CATALOG_DATA` aggregates events.
- `generateDataDictionary(entities: EntityTypeMeta[]): string` — returns full markdown
- New script `scripts/generate-data-dictionary.mjs`
- Output: `docs/reference/Data Dictionary.md` or `docs/Data Dictionary.md` (in-place replacement)

**Files**:
- New: `src/domain/docs/dataDictionaryGenerator.ts` (~90 LOC)
- New: `src/domain/docs/entityTypeRegistry.ts` (~50 LOC — registry constant aggregating all entity types)
- New: `scripts/generate-data-dictionary.mjs` (~40 LOC)
- Modified: `esbuild.config.mjs` (~5 LOC)
- Modified: `package.json` (~2 LOC)
- New: `tests/domain/docs/dataDictionaryGenerator.test.ts` (~80 LOC)

## Dependency Graph

```
Inc 1 (Cycle Reports)     ──→ Independent
Inc 2 (Traceability)      ──→ Independent
Inc 3 (Command Ref)       ──→ Depends on C50 Inc 1 (CommandMeta) — already delivered
Inc 4 (Event Catalog Gen) ──→ Independent
Inc 5 (Data Dict Gen)     ──→ Independent (no cross-ref to Inc 4)
```

All increments are independent — maximum parallelism.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `catalog.ts` import from Node script is complex (ESM/CJS, Obsidian deps) | High | Use `tsx` runner or parse catalog data as structured text rather than importing TS |
| Entity type metadata scattered across domains (no single registry) | Medium | Create `entityTypeRegistry.ts` as a centralized constant — one-time aggregation effort |
| Traceability enrichment modifies existing vault files | Medium | Additive-only (never removes properties); dry-run mode for review before applying |
| Generated docs diverge from manual quality/formatting | Medium | Use manual docs as template; preserve existing section structure and formatting conventions |
| Build pipeline slows down with 4 additional generation steps | Low | Only regenerate on production build (`npm run build`), not dev watch |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~75 (Inc 1: 15, Inc 2: 18, Inc 3: 12, Inc 4: 18, Inc 5: 12) |
| Post-cycle tests | ~5,624 |
| Production LOC added | ~690 |
| Auto-generated docs | 4 (Cycle Report, Command Ref, Event Catalog, Data Dictionary) |
| Manual docs replaced | 2 (Event Catalog, Data Dictionary) |
| Phantom events detected | 0 (all events match source after generation) |
| Traceability gaps identified + enriched | Coverage % of inbox→PBI→cycle chains |
| Tech debt resolved | TD-90 |
| Increments | 5 |

## Deferred Items

| Item | Target | Rationale |
|------|--------|-----------|
| Traceability Analytics Hub integration | Future cycle | Data quality first; queryable trace data requires adapter pattern |
| Traceability custom visualization | Not planned | Obsidian graph view handles this natively; no custom UI needed |
| Data Dictionary ↔ Event Catalog cross-references | Future cycle | Convention-based links sufficient for now |
| Git history timeline views | Beyond C55 | Complex visualization, low priority |
| AI-assisted report summarization | Beyond C55 | Premature without stable pipeline |
| Auto-generate domain documentation (TD-78) | C55 stretch | Depends on entity type registry from Inc 5 |
| C50 improvement backlog: dashboard preferences UX | Future UX cycle | Not dogfooding-aligned |
| C50 improvement backlog: command catalog search UX | Future UX cycle | Not dogfooding-aligned |

## Inbox Signals

| Inbox Item | Decision | Rationale |
|-----------|----------|-----------|
| How can Flowti be maintained inside Flowti | **Partially addressed** | C51 auto-gen + traceability = core dogfooding |
| Auto-create docs from codebase using typedoc | **Partially addressed** | Inc 3-5 auto-generate from code; TypeDoc integration remains future |
| Documentation must be built from source | **Addressed** | Inc 3 (commands), Inc 4 (events), Inc 5 (data dictionary) all build from source |
| Include generated reports in reviews | **Addressed** | Inc 1 (cycle reports) joins existing report pipeline |
| Event catalog dependencies hard to follow | **Addressed** | Inc 4 auto-generates catalog from source — no drift |
| Session auto-documentation | **Deferred** | Separate feature, not C51 scope |
