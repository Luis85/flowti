---
type: Flow
domain: Flowti
stage: done
description: End-to-end journey for auditing vault health, identifying documentation gaps, broken references, and coverage issues, then fixing them iteratively
domains:
  - Settings
services:
  - SettingsService
events:
  - doc.create
  - doc.created
  - subscription.create
  - subscription.created
  - settings.updateCatalogDomains
tags:
  - health
  - documentation
---

# Audit Vault Health

## Overview

As a vault grows with domains, services, flows, systems, actors, and products, documentation consistency and cross-reference integrity naturally degrade. This journey covers the full audit workflow: opening the Health tab to get an aggregate score, drilling into each failing check to understand the issues, navigating to affected entities to fix them, and returning to verify improvements — iterating until the vault reaches an acceptable health level.

## Trigger

User wants to assess overall documentation quality, detect broken references, find orphaned flows, or check event coverage before a major release or documentation review.

## Steps

### 1. Open Event Catalog

- **View/Service**: EventCatalogView
- **User Action**: User opens the Event Catalog from the sidebar ribbon icon or command palette
- **System Response**: Catalog loads with the Dashboard tab showing entity counts and quick actions
- **Events**: (none — UI render)

### 2. Navigate to Health Tab

- **View/Service**: EventCatalogView (HealthTab)
- **User Action**: User clicks the "Health" tab (heart-pulse icon) in the tab bar
- **System Response**: System scans all entity tabs (Domains, Services, Flows, Systems, Actors, Products) for fresh data, computes 6 health checks, and renders the score card with overall percentage and grouped check list
- **Events**: (none — pure computation from existing state)

### 3. Assess Overall Score

- **View/Service**: HealthTab (master panel)
- **User Action**: User reads the overall score card showing the aggregate percentage and "N of M checks passing" summary
- **System Response**: Score card is color-coded: green (>= 80%), yellow (>= 50%), red (< 50%). Category groups show Documentation, Consistency, References, and Coverage with individual check severity dots
- **Events**: (none — UI render)

### 4. Drill Into Documentation Coverage

- **View/Service**: HealthTab (detail panel)
- **User Action**: User clicks the "Documentation Coverage" check row
- **System Response**: Detail panel shows check title with severity badge, summary (e.g., "5 / 12 entities documented"), progress bar, and a list of undocumented domains and services with reasons
- **Events**: (none — UI render)

### 5. Navigate to Undocumented Entity

- **View/Service**: HealthTab → DomainsTab
- **User Action**: User clicks the name of an undocumented domain in the affected items list
- **System Response**: View navigates to the Domains tab with that domain selected in the detail panel. The "Create Doc" action is visible in the actions section
- **Events**: (none — UI navigation)

### 6. Create Documentation

- **View/Service**: DomainsTab
- **User Action**: User clicks "Create Doc" in the domain detail panel
- **System Response**: A DomainDoc markdown file is created with standard frontmatter in the configured docs folder. The domain's detail panel updates to show the doc path and "Open Doc" action
- **Events**: `doc.create` → `doc.created`

### 7. Return and Verify Improvement

- **View/Service**: HealthTab
- **User Action**: User clicks back to the Health tab
- **System Response**: System re-scans all entities and recomputes health checks. The Documentation Coverage score has increased. The fixed domain no longer appears in the affected items list. The overall score card updates
- **Events**: (none — re-scan)

### 8. Check Reference Integrity

- **View/Service**: HealthTab (detail panel)
- **User Action**: User clicks the "Reference Integrity" check row
- **System Response**: Detail panel shows any broken references — flow docs referencing non-existent domains, systems referencing non-existent services, actors referencing unknown events, etc. Each item shows the entity name and the specific broken reference
- **Events**: (none — UI render)

### 9. Fix Broken References

- **View/Service**: HealthTab → FlowsTab / SystemsTab
- **User Action**: User clicks an entity with a broken reference, navigates to the entity doc, and corrects the frontmatter — either fixing the spelling, removing the stale entry, or creating the missing target entity
- **System Response**: After the fix and returning to the Health tab, the broken reference disappears from the affected items list
- **Events**: `doc.create` → `doc.created` (if creating missing entities)

### 10. Review Orphaned Flows

- **View/Service**: HealthTab (detail panel)
- **User Action**: User clicks the "Orphaned Flows" check row
- **System Response**: Detail panel lists flows not referenced by any system, actor, or product. The user decides for each: connect it to a higher-level entity or accept it as standalone
- **Events**: (none — UI render)

### 11. Review Event Coverage

- **View/Service**: HealthTab (detail panel)
- **User Action**: User clicks the "Event Coverage" check row
- **System Response**: Detail panel lists events without subscriptions or definitions. The user can navigate to each event and configure monitoring
- **Events**: `subscription.create` → `subscription.created` (when configuring subscriptions)

### 12. Achieve Target Score

- **View/Service**: HealthTab
- **User Action**: User iterates through remaining checks, fixing issues and returning to verify
- **System Response**: Overall score increases with each fix. When all important checks pass, the score card shows green with a high percentage
- **Events**: (none — iterative verification)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Which checks to prioritize | Documentation, Consistency, References, Coverage | Documentation first |
| System events inclusion | Show / Hide system-tagged entities | Hidden |
| Orphaned flow disposition | Connect to higher entity / Accept as standalone | User discretion |
| Event coverage target | Monitor all events / Monitor only domain events | Domain events only |
| Acceptable health score | 100% / 80%+ / 50%+ | 80%+ |

## Events Sequence

```
(open catalog) → (navigate to Health) → (scan entities) → (compute checks)
  → (drill into check) → (navigate to entity) → doc.create → doc.created
  → (return to Health) → (re-scan) → (verify improvement) → (repeat)
```

## Related Use Cases

- [[Review Vault Health Score]]
- [[Fix Documentation Gaps]]
- [[Resolve Broken References]]
- [[Improve Event Coverage]]
