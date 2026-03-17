---
type: ProductBacklogItem
feature: "[[Event Catalog PRD]]"
priority: high
stage: done
userStories:
  - "[[As User, I want to add a domain to my areas, so that I have a confined space for daily-business]]"
  - "[[As User, I want to attach my Props to domains]]"
  - "[[I want to attach props like Deliverables or Artifacts as a Docu to a domain]]"
  - "[[I want to attach Requirements to my Domains]]"
useCases:
  - "[[Document a Business Domain]]"
  - "[[Map Systems and Actors]]"
  - "[[Model a Business Flow]]"
  - "[[Track Products]]"
---

## User Story

As a domain modeller, I want to document business domains, flows, systems, actors, and products inside the Event Catalog so that every piece of domain knowledge is cross-referenced, navigable, and backed by markdown files in my vault.

## Functional Requirements

- [x] Domains tab: hybrid scan merges file-based and catalog-derived entries; "undocumented" badge + "Create Doc" action for catalog-only domains
- [x] Domain CRUD: "+" creates `DomainDoc` at `{docsRootPath}/Domains/`, delete removes file; `normalizeDocFrontmatter()` auto-corrects non-standard field names
- [x] "Mark as Area" action creates `AreaDoc` at `02 - Areas/{domainName}/` with `createFolders: true`
- [x] Services tab: same hybrid scan pattern with `ServiceEntry`, CRUD, and undocumented indicators
- [x] Categories tab: merged with settings visibility; `CategoryEntry` shows `visible` flag
- [x] Flows tab: file-driven scan of `{docsRootPath}/Flows/`; `FlowEntry` with explicit events resolved against catalog via `resolvedEvents[]`
- [x] Systems tab: file-driven scan of `{docsRootPath}/Systems/`; `SystemEntry` derives events from linked domains and services
- [x] Actors tab: file-driven scan of `{docsRootPath}/Actors/`; detail panel with Overview, Goals & Needs, Key Events, Domains, Services, Notes
- [x] Products tab: file-driven scan of `{docsRootPath}/Products/`; dashboard stats grid with product count and "New Product" quick action
- [x] Cross-references: all detail views show Related Flows, Systems, Actors, and Products sections via `findRelated*()` helpers; empty sections auto-hidden
- [x] `docsRootPath` setting with migration from legacy `eventDocsBasePath`
- [x] `metadataCache` timing: 500ms delay after `createFile()` before scan-based render

## Acceptance Criteria

- [x] All seven tabs (Domains, Services, Events, Flows, Systems, Actors, Products) render with file-driven data
- [x] Creating a domain doc and marking it as an Area produces files at the correct vault paths
- [x] Cross-reference sections appear on detail panels when overlapping domains, services, or events exist
- [x] Frontmatter auto-normalization corrects non-standard field names without data loss
- [x] `npm run build` passes
