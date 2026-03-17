---
stage: idea
type: ProductBacklogItem
feature: "[[Hubs PRD]]"
priority: medium
phase: 4
dependencies:
  - "[[TD-49 Layout abstraction layer]]"
  - "[[TD-50 Workspace shell layout]]"
  - "[[TD-54 Event Catalog hub migration]]"
---

## User Story - Problemspace

As a product owner, I want a Product Hub so that I can manage product entities, track features and backlog items, and see product-related events and documentation in one workspace.

### User Pains

- Product information is scattered across vault notes with no structured workspace
- No way to see all features, backlog items, and events related to a product in one view
- Products tab in Event Catalog shows basic product entries but lacks domain-specific workflows
- No product dashboard with KPIs (feature count, completion, documentation health)

### User Needs

- Product dashboard with KPIs (features, PBIs, documentation coverage)
- Feature list with filtering and detail view
- Backlog management with priority and status tracking
- Product-related events and documentation cross-references
- Session support for Product-specific documentation workflows

## Solutionstatement

### Use Case

- Flow: User opens Product Hub → sees product dashboard → navigates to features tab → selects feature → sees detail with related events and PBIs
- Gherkin:
  ```gherkin
  Given the Product Hub is open for product "Flowti IBDE"
  When the user navigates to the Features tab
  Then all features with type "FeatureTemplate" in the product folder are listed
  And selecting a feature shows its PRD details, maturity score, and related events
  ```

### Functional Requirements

- [ ] Product Hub opens via command or hub picker, scoped to a specific product
- [ ] Dashboard tab:
  - Feature count, PBI count, documentation health KPIs
  - Quick actions: New Feature, New PBI, Start Session
  - Recent activity for this product
- [ ] Features tab (`split_dock`):
  - Master: feature list scanned from product folder (type: FeatureTemplate)
  - Detail: PRD summary, maturity score, related events, related PBIs
- [ ] Backlog tab (`table`):
  - PBI list scanned from backlog folder (type: ProductBacklogItemTemplate)
  - Columns: name, priority, status, feature link
- [ ] Sessions tab:
  - Session history for this product hub
  - Start new session button
- [ ] `ProductHubAdapter extends HubAdapter`

### Technical Requirements

- Adapter scans product folder for `FeatureTemplate` and `ProductBacklogItemTemplate` files via metadataCache
- Feature maturity score computed from frontmatter fields (matches PRD Template scoring)
- Cross-references resolved against Event Catalog entries
- Products folder path derived from settings

### Constraints

- Product Hub is read-only for v1 (views product docs, does not create features through custom forms)
- Feature and PBI creation use standard vault note creation with templates

## Acceptance Criteria

- [ ] Product Hub opens scoped to a product with dashboard + features + backlog + sessions tabs
- [ ] Features tab shows all FeatureTemplate files with maturity scores
- [ ] Backlog tab shows all ProductBacklogItemTemplate files
- [ ] ProductHubAdapter implements HubAdapter interface
- [ ] All tabs render via Hub framework
- [ ] `npm run build` passes
