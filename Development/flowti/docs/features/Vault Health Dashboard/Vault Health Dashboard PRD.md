---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events:
  - health.check.completed
  - health.score.changed
maturity: L1
business_value: 4
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 3
test_cost: 3
priority: 4
---

# Feature: Vault Health Dashboard

---

## 1. Problem Statement

Users managing complex vaults with many domains, services, flows, systems, and events need continuous visibility into the health of their documentation and configuration. Without a centralized health dashboard, coverage gaps, broken references, and inconsistent frontmatter accumulate silently.

- **Who is affected?** Vault maintainers, system architects, and anyone responsible for documentation quality.
- **What breaks?** Undocumented entities, stale cross-references, and unconfigured events degrade the vault's usefulness over time.
- **Why it matters:** A health dashboard transforms passive documentation into an actively maintained knowledge base by surfacing what needs attention.

---

## 2. Outcome

- **User can** open the Health tab to see an overall vault health score, review diagnostic checks grouped by category, and navigate directly to entities that need fixes.
- **System can** run 6+ automated health checks across documentation, consistency, references, and coverage categories, scoring each and computing an aggregate percentage.
- **Domain gains** a quality gate that continuously validates the vault's documentation and configuration integrity.

Measurable success:
- Health score visible on every catalog visit
- Affected items are clickable and navigate to the entity's tab
- Score updates automatically as the user fixes issues

---

## 3. Scope

### In Scope

- Health tab in Event Catalog with master-detail layout
- Overall health score (0-100) with color-coded severity
- 6 diagnostic checks: Documentation Coverage, Frontmatter Completeness, Reference Integrity, Orphaned Flows, Event Coverage, Subscription & Definition Health
- Category grouping: Documentation, Consistency, References, Coverage
- Affected items list with entity navigation
- Search/filter on health checks
- Score recalculation on tab activation

### Out of Scope (future)

- Historical health score tracking (see Tracking and Reporting feature)
- Custom health checks defined by users
- Automated fix suggestions or auto-repair
- Health score notifications or alerts
- Health checks for external integrations

---

## 4. UX Entry Points

- **Event Catalog**: Health tab (heart-pulse icon) in the tab bar
- **Dashboard**: Health score card shown on the Event Catalog dashboard
- **Related use cases**: [[Review Vault Health Score]], [[Fix Documentation Gaps]], [[Resolve Broken References]], [[Improve Event Coverage]]

---

## 5. Functional Requirements

- [x] Health tab renders master panel with score card and grouped check list
- [x] Overall score computed as average of individual check scores (0-100)
- [x] Score card color-coded: green (>= 80), yellow (>= 50), red (< 50)
- [x] Checks grouped under 4 category headers: Documentation, Consistency, References, Coverage
- [x] Each check row shows severity dot, title, and score percentage badge
- [x] Clicking a check shows detail panel with summary, progress bar, and affected items
- [x] Affected items show entity name, reason, and entity type
- [x] Clickable entity names navigate to the corresponding tab (Domains, Services, Flows, etc.)
- [x] Search filter narrows visible checks by title or summary text
- [x] System events filtering respected (showSystemEvents setting)
- [ ] Health score exposed as dashboard widget for Hub integration

---

## 6. Data Model Impact

No persistent entities — health checks are computed on-the-fly from catalog state.

Key types (already implemented in `src/ui/catalog/healthChecks.ts`):

```
HealthReport
  overallScore: number        (0-100)
  checks: HealthCheckResult[]

HealthCheckResult
  id: string
  title: string
  category: "documentation" | "consistency" | "references" | "coverage"
  severity: "pass" | "warn" | "fail"
  score: number               (0-1 fraction)
  summary: string
  items: HealthCheckItem[]

HealthCheckItem
  name: string
  reason: string
  entityType: string          ("domain" | "service" | "flow" | "system" | "actor" | "product" | "event")
```

---

## 7. Event Impact

### Produced

- `health.check.completed` (proposed) — payload: `{ overallScore, checkCount, failCount }`
- `health.score.changed` (proposed) — payload: `{ previousScore, newScore }`

### Consumed

- All catalog state (domains, services, flows, systems, actors, products, events, subscriptions, definitions)
- `settings.updated` — to respect `showSystemEvents` toggle

---

## 8. UI Layout Impact

- Health tab uses split-dock layout (master: score card + check list, detail: check details + affected items)
- Consistent with other catalog tabs (Domains, Services, Flows, etc.)
- Empty state shows heart-pulse icon, quick stats, and "Select a health check" prompt

---

## 9. Adapter Impact

Existing implementation:

```
HealthTab (src/ui/catalog/HealthTab.ts)
├── render(): void
├── scan(): void                  (runs all health checks)
├── getReport(): HealthReport
└── private renderMaster/renderDetail methods

Health check functions (src/ui/catalog/healthChecks.ts)
├── checkDocCoverage(state): HealthCheckResult
├── checkFrontmatterCompleteness(state): HealthCheckResult
├── checkReferenceIntegrity(state, allEvents): HealthCheckResult
├── checkOrphanedFlows(state): HealthCheckResult
├── checkEventCoverage(state, allEvents): HealthCheckResult
├── checkSubscriptionHealth(state, allEvents): HealthCheckResult
└── runHealthChecks(state, allEvents): HealthReport
```

---

## 10. Non-Functional Requirements

- **Performance**: Health checks execute in < 100ms for vaults with 500 entities
- **Purity**: All health check functions are side-effect-free and operate on plain data — no DOM, no Obsidian imports
- **Testability**: Health checks are trivially unit-testable with mock CatalogState
- **Freshness**: Checks re-run on every tab activation — no stale scores

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Health checks becoming slow with large vaults | Profile and optimize hot paths; consider caching between tab switches |
| Users confused by low scores on new vaults | Document that scores improve as documentation is added; empty vault scores 100% |
| Check thresholds too strict or too lenient | Thresholds chosen to be pragmatic (e.g., event coverage passes at 50%) |
| Navigation from affected items feeling disconnected | Smooth tab switch with entity pre-selected |

---

## 12. Acceptance Criteria

- [x] Health tab shows overall score card with color-coded severity
- [x] 6 diagnostic checks displayed under 4 category headers
- [x] Clicking a check populates the detail panel with summary and affected items
- [x] Clicking an affected item name navigates to the correct entity tab
- [x] Search filter narrows visible checks
- [x] System events toggle controls which entities are included in checks
- [ ] Health score displayed on Hub dashboard widget

---

## 13. Definition of Done

- [x] `HealthTab` component implemented with master-detail layout
- [x] 6 pure health check functions implemented in `healthChecks.ts`
- [x] `runHealthChecks()` aggregates individual scores into overall report
- [x] Navigation from affected items to entity tabs working
- [x] Search/filter integration working
- [x] Unit tests cover all 6 health check functions
- [x] Use cases documented: UC-93 through UC-96
- [x] `npm run build` passes
- [ ] Hub dashboard widget integration
