---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - subscription.created
  - subscription.updated
  - subscription.deleted
  - subscription.loaded
  - eventDefinition.created
  - eventDefinition.updated
  - eventDefinition.deleted
  - eventDefinition.loaded
  - settings.updateShowSystemEvents
maturity: L4
business_value: 5
implementation_cost: 5
maintenance_cost: 3
discovery_cost: 3
design_cost: 4
test_cost: 3
priority: 2
---

# Event Catalog PRD

> Architecture reference: [[Event Catalog]]

---

## 1. Problem Statement

Users of an event-driven system need a way to understand what events exist, what they mean, and how they relate to domains, services, and documentation. Without a central semantic map, users must read source code to discover events, cannot determine whether to subscribe to an event, and have no way to navigate from an event to its domain context or related documentation. The system's vocabulary remains opaque and untrusted.

---

## 2. Outcome

The Event Catalog provides a semantic map of what can happen in the system. Users can browse events by domain, service, category, flow, system, actor, and product. Each event shows its description, payload overview, subscription guidance, and related concepts. The catalog serves as a navigation hub connecting events to meaning, domains, services, and vault-based documentation files.

---

## 3. Scope

### In Scope
- 8-tab master/detail layout: Domains, Services, Events, Flows, Systems, Actors, Products
- Dashboard with stats grid, quick actions, and recent events
- Event detail pages with description, payload, subscription guidance, related events
- Per-event config modal (EventConfigModal) with overview, subscription form, definition form
- Category filtering with system event toggle
- Cross-references: Related Flows/Systems/Actors sections on all detail views
- File-driven documentation: scan vault folders for typed frontmatter docs (DomainDoc, ServiceDoc, CategoryDoc, FlowDoc, SystemDoc, ActorDoc, ProductDoc)
- Hybrid scan: merge file-based entries with catalog-derived entries
- Config count badges ("2 subs, 1 def") on event entries
- Tag-based filtering (`["system"]` tag hides events when `showSystemEvents` is false)

### Out of Scope
- Event log / live event stream (separate concern)
- Workflow editor or automation builder
- Plugin-specific API reference
- Event replay or dry-run mode

---

## 4. UX Entry Points

- **Sidebar leaf**: `flowti-event-catalog` registered as a view, opened via command or ribbon icon
- **Tab navigation**: Domains | Services | Events | Flows | Systems | Actors | Products
- **Event names**: clickable in catalog list, open detail panel
- **Config icon**: settings-2 icon on event entries opens EventConfigModal
- **File menu**: right-click actions for creating domain/service/flow/system/actor/product docs
- **Settings**: "Event System" section with `showSystemEvents` toggle

---

## 5. Functional Requirements

- [x] Display all registered events grouped by category (Core, Lifecycle, User, Settings, Installer, Discovery, Filter, Notification, Subscription, Ingestion, Event Definition, Data Exchange)
- [x] Each event shows name, description, domain, source category, and payload overview
- [x] Domain tab: hybrid scan merging file-based DomainDoc entries with catalog-derived entries
- [x] Service tab: hybrid scan merging file-based ServiceDoc entries with catalog-derived entries
- [x] Category tab: merged with settings visibility; undocumented badge for entries without doc files
- [x] Flows tab: file-driven scan of `docsRootPath/Flows/` with FlowDoc frontmatter; events resolved against catalog
- [x] Systems tab: file-driven scan of `docsRootPath/Systems/` with SystemDoc frontmatter
- [x] Actors tab: file-driven scan of `docsRootPath/Actors/` with ActorDoc frontmatter
- [x] Products tab: file-driven scan of `docsRootPath/Products/` with ProductDoc frontmatter
- [x] Dashboard with stats grid and "New Flow/System/Actor/Product" quick actions
- [x] EventConfigModal: 3-page hub (overview with sub/def lists, subscription form, definition form)
- [x] System event toggle: events tagged `["system"]` hidden when `showSystemEvents` is false
- [x] Cross-references: all 6 detail views show Related Flows/Systems/Actors sections
- [x] CRUD for domain/service/flow/system/actor/product documentation files
- [x] Auto-normalize non-conforming frontmatter via `normalizeDocFrontmatter()`
- [x] Config count badges and debounced re-render on subscription/definition state changes

---

## 6. Data Model Impact

| Entity | Key Fields |
|--------|-----------|
| `EventCatalogEntry` | `type`, `description`, `domain`, `category`, `payload`, `tags[]` |
| `EventCatalogMeta` | `tags?`, `source?`, `stability?` |
| `DomainEntry` | `name`, `description`, `services[]`, `categories[]`, `events[]`, `filePath`, `configuredCount`, `visibleCount` |
| `ServiceEntry` | `name`, `description`, `domains[]`, `events[]`, `filePath`, `configuredCount` |
| `CategoryEntry` | `name`, `description`, `domains[]`, `services[]`, `events[]`, `filePath`, `visible` |
| `FlowEntry` | `name`, `description`, `events[]`, `domains[]`, `services[]`, `filePath`, `resolvedEvents[]` |
| `SystemEntry` | `name`, `description`, `domains[]`, `services[]`, `filePath`, `events[]` |
| `ActorEntry` | `name`, `description`, `events[]`, `domains[]`, `services[]`, `filePath`, `resolvedEvents[]` |
| `ProductEntry` | `name`, `description`, `events[]`, `domains[]`, `services[]`, `filePath`, `resolvedEvents[]` |

---

## 7. Event Impact

### Produced
- `settings.updateShowSystemEvents` (view toggle to SettingsService)

### Consumed
- `subscription.created`, `subscription.updated`, `subscription.deleted`, `subscription.loaded`
- `eventDefinition.created`, `eventDefinition.updated`, `eventDefinition.deleted`, `eventDefinition.loaded`
- `subscription.refresh`, `eventDefinition.refresh` (triggers `.loaded` emission)

---

## 8. UI Layout Impact

- Sidebar leaf with 825 LOC orchestrator + 13 components under `src/ui/catalog/`
- Master/detail split layout within the leaf
- Tab bar with 8 tabs across the top
- Detail panel with progressive disclosure: overview first, technical details on demand
- EventConfigModal overlays catalog as a modal dialog

---

## 9. Adapter Impact

- File scanning uses `metadataCache` for frontmatter reading (with timing caveat: `setTimeout` for scan-based views)
- FileSystemClient used for CRUD operations on documentation files
- `setIcon` from Obsidian used for UI icons
- `fmString()` helper with fallback field names for forgiving frontmatter parsing

---

## 10. Non-Functional Requirements

- Debounced re-render (`scheduleRender()`) to avoid excessive redraws on rapid state changes
- Progressive disclosure: overview first, details on demand, technical references one click away
- Semantic-first language: events described by what they represent, not how they are emitted
- The catalog is the single source of truth for event definitions
- File scanning tolerates missing or malformed frontmatter gracefully

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| metadataCache not ready after file creation | High | Medium | `setTimeout(() => scheduleRender(), 500)` delay |
| Large number of events overwhelms catalog view | Low | Medium | Category filtering + system event toggle |
| Stale config counts after rapid subscription changes | Medium | Low | Debounced re-render + 8 event listeners for state changes |
| Frontmatter schema drift in doc files | Medium | Medium | `normalizeDocFrontmatter()` auto-correction + forgiving `fmString()` |
| Undocumented entries confuse users | Low | Low | "Undocumented" badge with "Create Doc" action |

---

## 12. Acceptance Criteria

- [x] All registered events appear in the Events tab grouped by category
- [x] Each event detail page shows description, payload overview, domain, and related events
- [x] Domains/Services tabs show hybrid entries from both files and catalog
- [x] Flows/Systems/Actors/Products tabs scan vault folders for typed frontmatter docs
- [x] CRUD operations create and delete documentation files with correct frontmatter
- [x] EventConfigModal opens from catalog with pre-filled event type and shows subscription/definition lists
- [x] System events are hidden when `showSystemEvents` is false
- [x] Cross-reference sections appear on all detail views showing related flows, systems, and actors
- [x] Config count badges update reactively when subscriptions or definitions change
- [x] Users can explain what an event means without reading code
- [x] Users can navigate from any event to its domain documentation

---

## 13. Definition of Done

The Event Catalog is done when all 8 tabs render correctly with hybrid file/catalog data, the EventConfigModal provides per-event subscription and definition management, system event filtering works, cross-references are displayed on all detail views, and users can discover, understand, and act on events without reading source code. All tests pass and `npm run build` succeeds.
