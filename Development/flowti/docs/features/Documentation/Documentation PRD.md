---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - settings.updateDocsRootPath
  - settings.updateShowSystemEvents
maturity: L4
---

# Documentation PRD

> Architecture reference: [[Documentation]]

## 1. Problem Statement

Documentation is typically treated as a separate chore, disconnected from the system being documented. Teams create documentation artifacts that quickly become stale because maintaining them requires manual effort outside the normal workflow. Domain knowledge, service boundaries, event flows, and system architecture need a living documentation approach that stays current through system usage rather than periodic manual updates.

## 2. Outcome

Users build a living documentation system by simply using Flowti. Domains, services, categories, flows, systems, actors, and products are documented as markdown files with structured frontmatter. The Event Catalog view provides a central hub where all documentation entities are visible, cross-referenced, and navigable. Documentation stays current because it is file-driven -- the same files that configure behavior also serve as documentation.

## 3. Scope

### In Scope

- File-driven documentation for 7 entity types: Domains, Services, Categories, Flows, Systems, Actors, Products
- Configurable documentation root path (`docsRootPath` setting)
- Automatic folder structure creation under docs root
- Hybrid scan approach: file-based entries merged with catalog-derived entries
- CRUD operations (create/delete doc files) from the UI
- Cross-reference rendering (related flows, systems, actors, products)
- "Undocumented" indicators for catalog-only entries without doc files
- Frontmatter auto-normalization for non-conforming files
- Event tagging with `showSystemEvents` toggle
- Tab-based navigation (Domains, Services, Events, Flows, Systems, Actors, Products)
- "Mark as Area" action for promoting domains to Areas

### Out of Scope

- Auto-generated prose documentation
- Documentation versioning / change history
- External documentation hosting or publishing
- AI-assisted documentation writing
- Diagram generation (Mermaid, PlantUML)

## 4. UX Entry Points

- **Event Catalog sidebar view**: 7 tabs for browsing all documentation entities
- **Settings tab**: `docsRootPath` configuration
- **Detail panels**: Master-detail layout per entity type with CRUD actions
- **"+" button**: Create new doc file for any entity type
- **"Create Doc" action**: Available on undocumented catalog-derived entries
- **"Mark as Area" button**: Promotes a domain to an Area folder

## 5. Functional Requirements

- [x] Scan markdown files with typed frontmatter (`DomainDoc`, `ServiceDoc`, `CategoryDoc`, `FlowDoc`, `SystemDoc`, `ActorDoc`, `ProductDoc`)
- [x] Merge file-scanned entries with catalog-derived entries (hybrid approach)
- [x] Render master-detail views for all 7 entity types
- [x] Create new documentation files with correct frontmatter templates
- [x] Delete documentation files from the UI
- [x] Auto-normalize non-conforming frontmatter to standard schema
- [x] Display cross-references between entities (related flows, systems, actors, products)
- [x] Show "undocumented" badge for entries without doc files
- [x] Support configurable `docsRootPath` with migration from legacy `eventDocsBasePath`
- [x] Filter system-tagged events via `showSystemEvents` toggle
- [x] Display event configuration counts (subscriptions, definitions) as badges
- [x] Resolve events listed in frontmatter against the event catalog

## 6. Data Model Impact

| Entity | Frontmatter Type | Key Fields |
|--------|-----------------|------------|
| `DomainEntry` | `DomainDoc` | name, description, services[], categories[], events[], filePath |
| `ServiceEntry` | `ServiceDoc` | name, description, domains[], events[], filePath |
| `CategoryEntry` | `CategoryDoc` | name, description, domains[], services[], events[], filePath |
| `FlowEntry` | `FlowDoc` | name, description, events[], domains[], services[], filePath |
| `SystemEntry` | `SystemDoc` | name, description, domains[], services[], filePath, events[] |
| `ActorEntry` | `ActorDoc` | name, description, events[], domains[], services[], filePath |
| `ProductEntry` | `ProductDoc` | name, description, events[], domains[], services[], filePath |

All entries have a `filePath` that is `null` for catalog-derived undocumented entries.

## 7. Event Impact

### Produced

- `settings.updateDocsRootPath` -- Documentation root path changed
- `settings.updateShowSystemEvents` -- System event visibility toggled

### Consumed

- `subscription.created/updated/deleted/loaded` -- Updates config count badges
- `eventDefinition.created/updated/deleted/loaded` -- Updates config count badges
- File system events -- Triggers re-scan on doc file changes

## 8. UI Layout Impact

- **Event Catalog view**: 7-tab layout (Domains | Services | Events | Flows | Systems | Actors | Products)
- **Master-detail pattern**: Left panel lists entries, right panel shows detail with sections
- **Detail sections per type**: Overview, Events, Cross-references, Actions
- **Filter bar**: Search input, category filter, system events toggle chip
- **Stats dashboard**: Card grid with counts for each entity type + quick actions

## 9. Adapter Impact

- `FileSystemClient`: `createFile()`, `deleteFile()` for doc CRUD
- `metadataCache`: Frontmatter scanning for hybrid approach
- Path functions in `eventDocTemplate.ts`: `getEventDocPath`, `getDomainDocPath`, `getServiceDocPath`, `getCategoryDocPath`, `getFlowDocPath`, `getSystemDocPath`, `getActorDocPath`
- Scan methods: `scanDomains()`, `scanServices()`, `scanCategories()`, `scanFlows()`, `scanSystems()`, `scanActors()`
- Frontmatter helpers: `fmString()` with fallback field names, `normalizeDocFrontmatter()`

## 10. Non-Functional Requirements

- Folder scans must complete within 2 seconds for vaults with 1000+ files
- `metadataCache` timing: 500ms delay after file creation before scan-based render
- Cross-reference resolution must not cause O(n^2) performance degradation
- Documentation files must be valid markdown readable by any Obsidian user

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `metadataCache` not indexed after file creation | Medium | 500ms setTimeout before render |
| Users manually edit frontmatter incorrectly | Low | Auto-normalize with `normalizeDocFrontmatter()` |
| Large number of undocumented entries clutters UI | Low | "Undocumented" badge + filter options |
| Migration from `eventDocsBasePath` fails | Medium | Defensive migration with suffix stripping |

## 12. Acceptance Criteria

- [x] All 7 entity types render in their respective tabs
- [x] Creating a new doc file produces correct frontmatter and appears in the list
- [x] Deleting a doc file removes it from the list
- [x] Undocumented catalog entries show "undocumented" badge with "Create Doc" action
- [x] Cross-references display related entities correctly
- [x] `docsRootPath` setting change updates all doc paths
- [x] System events toggle hides/shows system-tagged events
- [x] Event config badges show correct subscription and definition counts
- [x] "Mark as Area" creates the area folder and file
- [x] Frontmatter auto-normalization fixes non-conforming files silently

## 13. Definition of Done

- All acceptance criteria verified manually
- All 7 scan methods tested with unit tests
- Cross-reference helpers tested
- Frontmatter normalization tested
- Settings migration tested
- `npm run build` passes (vitest, tsc, eslint, esbuild)
