---
type: ProductBacklogItem
feature: "[[Event System PRD]]"
priority: high
stage: done
userStories:
  - "[[As User, I want my changes on Event Documentation to be synced directly with the Event Catalog]]"
  - "[[As User, I want to document a domain, so that I have a better understanding about whats going on]]"
  - "[[As User, I want to document my workflow]]"
useCases:
  - "[[Navigate to Event Documentation]]"
  - "[[Review Enriched Context]]"
---

## User Story

As a knowledge worker using Flowti, I want to document domains, workflows, and events through file-driven markdown notes that stay in sync with the Event Catalog so that I can navigate from live events to their documentation and review enriched context without switching tools.

## Functional Requirements

- [x] File-driven documentation: Domains, Services, Categories, Flows, Systems, and Actors scanned from `docsRootPath` subfolders
- [x] Hybrid scan merges file-based entries with catalog-derived entries; undocumented items show badge and "Create Doc" action
- [x] Frontmatter schema per doc type (`DomainDoc`, `ServiceDoc`, `CategoryDoc`, `FlowDoc`, `SystemDoc`, `ActorDoc`) with auto-normalization
- [x] CRUD for all doc types: "+" button creates notes via `FileSystemClient.createFile()`, delete removes via `deleteFile()`
- [x] Clicking an event type name in the Event Log navigates to the Event Catalog detail panel for that event
- [x] Event Log entries display enriched inline context: watcher labels, file paths, error messages, emitted domain event names
- [x] Cross-reference sections on all detail views showing Related Flows, Systems, and Actors (auto-hidden when empty)
- [x] `docsRootPath` setting with migration from legacy `eventDocsBasePath`
- [x] Tab order: Domains | Services | Events | Flows | Systems | Actors | Products

## Acceptance Criteria

- [x] Creating or editing a domain/flow/system doc is reflected in the Event Catalog on next render
- [x] Clicking an event type in the Event Log opens the corresponding catalog detail panel
- [x] Enriched context summaries display inline for subscription matches, ingestion completions, failures, and definition matches
- [x] Cross-references resolve correctly between Flows, Systems, and Actors based on overlapping events, domains, or services
- [x] `npm run build` passes
