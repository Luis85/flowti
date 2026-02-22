---
type: Job to be Done
persona: "[[Knowledge Worker]]"
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: draft
description: "Manage typed entities in the vault through structured CRUD operations"
related_features: [Documentation Hub, Hubs, Event Catalog]
priority: low
---

## 1. Job Statement

**When** working with typed vault entities (domains, services, events, flows, products),
**I need to** perform structured CRUD operations (create, read, update, delete),
**so that** my vault stays organized and entities conform to their type schemas.

### Job Context
Obsidian vaults that manage structured entities — domains, services, events, flows, systems, actors, products — need consistent operations for creating, reading, updating, and deleting these entities. Without structured CRUD operations, entities are created with inconsistent frontmatter, required fields are missed, relationships are broken, and the vault's data quality degrades over time. This foundational job underpins almost every other JTBD: you cannot manage a product, track progress, or document architecture if the underlying entity operations are unreliable.

### Job Category
- **Type:** functional
- **Frequency:** daily
- **Criticality:** blocking

## 2. Scope

### In Scope
- Creating new typed entities with pre-populated templates and required frontmatter
- Reading and browsing entities through structured views (Hubs, Documentation Hub)
- Updating entity metadata and content with schema validation
- Deleting entities with relationship cleanup (orphan detection)
- Entity type schemas defining required and optional fields
- Bulk operations for managing multiple entities at once

### Out of Scope
- Entity-specific lifecycle management (see [[I need to manage a product]], [[I need to manage a project]])
- State tracking and progress monitoring (see [[I need to track something]])
- Data quality rules and validation (see [[I need to manage data-quality]])

## 3. Success Criteria

| # | Criterion | Measurable? |
|---|-----------|-------------|
| 1 | New entities are created with correct type-specific frontmatter via templates | yes |
| 2 | Entities are browsable by type through Documentation Hub and Hubs | yes |
| 3 | Entity updates preserve schema compliance and required fields | yes |
| 4 | Deleting an entity surfaces broken links and orphaned references | yes |
| 5 | All 7 entity types (Domains, Services, Events, Flows, Systems, Actors, Products) have defined schemas | yes |

## 4. Current Alternatives

### Workarounds
- Manual note creation with copy-paste frontmatter from existing notes
- Obsidian Templater plugin for basic scaffolding without schema enforcement
- No orphan detection or relationship cleanup on deletion

## 5. Form

### Feature Links

| Feature | Relationship | Coverage |
|---------|-------------|----------|
| [[Documentation Hub]] | primary | partial |
| [[Event Catalog]] | primary | full |
| [[Hubs]] | supporting | partial |

### Flow Links

| Flow | Role |
|------|------|
| [[Entity CRUD Flow]] | primary |
| [[Schema Validation Flow]] | supporting |
