---
type: ProductBacklogItem
feature: "[[Event Catalog PRD]]"
priority: medium
stage: draft
userStories:
  - "[[As User, I want to import an Obsidian Canvas into my Event Catalog so that I have a good baseline for further improvements]]"
  - "[[I need to export my Event Catalog and provide it to others]]"
  - "[[I need to import an Event Catalog from another Obsidian Vault]]"
  - "[[I want to see what User Stories are supported by the Event Catalog]]"
  - "[[I want to start a new Project from inside my Domain in the Event Catalog]]"
  - "[[I want to start a development project after creating a Product in the event catalog]]"
useCases: []
---

## User Story

As a team lead, I want to import an existing Obsidian Canvas or another vault's Event Catalog into my own, export my catalog for colleagues, and kick off projects directly from domains or products so that the catalog becomes a living launchpad for collaboration and delivery.

## Functional Requirements

- [ ] Canvas import: parse `.canvas` JSON, extract nodes and edges, map to DomainDoc/FlowDoc/SystemDoc entries, create files under `docsRootPath`
- [ ] Catalog export: serialize all catalog doc files (domains, services, flows, systems, actors, products) into a portable bundle (ZIP or structured folder)
- [ ] Catalog import: accept a portable bundle from another vault, merge or overwrite into the local `docsRootPath` with conflict resolution (skip/overwrite)
- [ ] User-story traceability: display which user stories are supported by each domain or flow via frontmatter `userStories` field; summary view in catalog
- [ ] Project from domain: "Start Project" action in domain detail panel creates a project scaffold (folder + template files) under a configurable projects path
- [ ] Project from product: "Start Dev Project" action in product detail panel creates a development project scaffold linked back to the product's domains and services

## Acceptance Criteria

- [ ] Importing a `.canvas` file produces valid doc files that appear in the catalog tabs
- [ ] Exporting the catalog produces a bundle that can be imported into a fresh vault
- [ ] Import conflict resolution correctly skips or overwrites existing files
- [ ] "Start Project" from a domain creates the expected folder structure
- [ ] "Start Dev Project" from a product creates a project linked to the product's domains
- [ ] `npm run build` passes after all features are implemented
