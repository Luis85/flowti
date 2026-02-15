---
type: Component
domain: Flowti
stage: done
description: "Pure health-check functions and types that derive diagnostics from CatalogState"
source: "[[Development/flowti/src/ui/catalog/healthChecks.ts|healthChecks.ts]]"
parent: "[[HealthTab]]"
tags:
  - catalog
  - component
  - logic
---

# healthChecks

## Description

A module of pure, side-effect-free functions that compute vault health diagnostics from `CatalogState` and `EventCatalogEntry[]`. No DOM manipulation, no Obsidian imports — making all functions trivially unit-testable. The module exports types (`HealthSeverity`, `HealthCheckCategory`, `HealthCheckItem`, `HealthCheckResult`, `HealthReport`), 6 individual check functions, and a `runHealthChecks` aggregate function.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogState` | interface | Source data for all checks (entity entries, subscriptions, definitions, settings) |
| `EventCatalogEntry` | interface | Event catalog shape for reference integrity and coverage checks |

## Types

**`HealthSeverity`**: `"pass" | "warn" | "fail"` — traffic-light severity for each check.

**`HealthCheckCategory`**: `"documentation" | "consistency" | "references" | "coverage"` — groups checks in the UI.

**`HealthCheckItem`**: `{ name, reason, entityType }` — a single affected item surfaced in the detail panel. `entityType` determines navigation target.

**`HealthCheckResult`**: `{ id, title, category, severity, score, summary, items }` — result of a single check. `score` is a fraction 0..1.

**`HealthReport`**: `{ overallScore, checks }` — aggregate report. `overallScore` is 0..100, computed as the mean of all check scores.

## Functions

### `checkDocCoverage(state: CatalogState): HealthCheckResult`

Checks documentation coverage for domains and services. An entity with `filePath === null` is undocumented. Excludes system entities when `showSystemEvents` is false and invisible entities. Severity: pass >= 80%, warn >= 50%, fail < 50%.

### `checkFrontmatterCompleteness(state: CatalogState): HealthCheckResult`

Checks that entity doc files have expected frontmatter fields populated:
- Flows must have `events[]` and `domains[]` or `services[]`
- Systems must have `domains[]` or `services[]`
- Actors must have `events[]`
- Products must have `events[]` or `domains[]`

Counts unique problem entities for scoring (a flow missing both events and domains counts as 1 problem, not 2). Severity: pass >= 90%, warn >= 60%, fail < 60%.

### `checkReferenceIntegrity(state: CatalogState, allEvents: EventCatalogEntry[]): HealthCheckResult`

Validates that all cross-references in entity docs resolve to existing catalog entries:
- Flow events/domains/services must exist
- System domains/services must exist
- Actor/product events must exist

Severity: pass = 0 broken refs, warn = 1–3, fail > 3.

### `checkOrphanedFlows(state: CatalogState): HealthCheckResult`

Finds flows not cross-referenced by any system (via overlapping domains/services), actor (via overlapping events), or product (via overlapping events). Severity: pass >= 80%, warn >= 50%, fail < 50%.

### `checkEventCoverage(state: CatalogState, allEvents: EventCatalogEntry[]): HealthCheckResult`

Checks what percentage of catalog events have at least one subscription or definition configured. Excludes system-tagged events when `showSystemEvents` is false. Severity: pass >= 50%, warn >= 20%, fail < 20%.

### `checkSubscriptionHealth(state: CatalogState, allEvents: EventCatalogEntry[]): HealthCheckResult`

Finds subscriptions watching event types not in the catalog and definitions with unknown source event types. Severity: pass = 0 orphaned, warn > 0.

### `runHealthChecks(state: CatalogState, allEvents: EventCatalogEntry[]): HealthReport`

Runs all 6 checks and aggregates results. `overallScore` = mean of all check scores, rounded to integer 0–100.

## Test Coverage

`tests/ui/catalog/healthChecks.test.ts` — 47 tests covering all 6 check functions and the aggregate. 100% statement coverage, 90% branch coverage.

## Related

- Parent: [[HealthTab]]
- Consumers: [[HealthTab]] (via `runHealthChecks()`)
