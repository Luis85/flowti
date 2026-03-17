---
type: Component
domain: Flowti
stage: done
description: "Master-detail tab for viewing vault health diagnostics, coverage scores, and broken reference detection"
source: "[[Development/flowti/src/ui/catalog/HealthTab.ts|HealthTab.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# HealthTab

## Description

HealthTab renders the Health tab within the Event Catalog view. It computes 6 health checks from the current `CatalogState` and displays an overall score card in the master panel with a grouped list of checks. Selecting a check opens the detail panel showing affected items with reasons and clickable navigation links. All health logic is pure (no side effects) and derived from existing scan data — no new EventBus events or services are involved.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `navigation`, `vaultQuery`, `getEntityFolder` |
| `EVENT_CATALOG` | constant | Built-in catalog entries for computing `allEvents` |
| `discoveredToCatalogEntries` | helper | Converts discovered events to catalog entry format |
| `runHealthChecks` | function | Runs all 6 health checks and aggregates the report |
| `healthChecks.ts` | module | Pure check functions: `checkDocCoverage`, `checkFrontmatterCompleteness`, `checkReferenceIntegrity`, `checkOrphanedFlows`, `checkEventCoverage`, `checkSubscriptionHealth` |

## State

**Reads from `deps.getState()`:**
- `domainEntries` — documentation coverage, reference integrity
- `serviceEntries` — documentation coverage, reference integrity
- `flowEntries` — frontmatter completeness, reference integrity, orphan detection
- `systemEntries` — frontmatter completeness, reference integrity, orphan matching
- `actorEntries` — frontmatter completeness, reference integrity, orphan matching
- `productEntries` — frontmatter completeness, reference integrity, orphan matching
- `discoveredEvents` — combined with EVENT_CATALOG for complete event set
- `subscriptions` — event coverage, subscription health
- `definitions` — event coverage, subscription health
- `showSystemEvents` — controls inclusion of system-tagged events/domains
- `filterText` — filters health checks by title or summary

**Internal state:**
- `report: HealthReport` — computed health report with 6 check results
- `selectedCheckId: string | null` — currently selected check for detail view

## Renders

**Master panel:**
- Score card showing overall health score (0–100) with color-coded severity (green/yellow/red), "Vault Health" heading, and "N of M checks passing" summary
- Check list grouped by category (Documentation, Consistency, References, Coverage)
- Each category has a header with count badge
- Each check row shows: severity dot (green/yellow/red), title, score percentage badge
- Clicking a check selects it and renders the detail panel

**Detail panel (check selected):**
- Header with severity icon, check title, severity/score/item-count badges
- Summary card with descriptive text
- Progress bar showing score visually with severity-colored fill
- Affected Items section listing each item with entity name and reason
- Item names are clickable for navigable entity types (domain, service, flow, system, actor, product, event)

**Detail empty state (no check selected):**
- Heart-pulse icon
- "Select a health check to view details" prompt
- Quick stats: overall score percentage, checks passing count, total items to fix

## Health Checks

| Check ID | Category | What It Checks |
|----------|----------|----------------|
| `doc-coverage` | Documentation | Domains and services without doc files (`filePath === null`) |
| `frontmatter-completeness` | Consistency | Flows without events, systems without domains/services, actors without events, products without events or domains |
| `reference-integrity` | References | Flow/system/actor/product referencing non-existent domains, services, or events |
| `orphaned-flows` | References | Flows not cross-referenced by any system, actor, or product |
| `event-coverage` | Coverage | Events without any subscription or definition configured |
| `subscription-health` | Coverage | Subscriptions or definitions referencing event types not in the catalog |

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | HealthTab is purely read-only; it derives all data from existing state |

## Related

- Parent: [[EventCatalogView]]
- Siblings: [[CatalogDashboard]], [[DomainsTab]], [[ServicesTab]], [[EventsTab]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]]
- Children: none
- Logic: [[healthChecks]]
