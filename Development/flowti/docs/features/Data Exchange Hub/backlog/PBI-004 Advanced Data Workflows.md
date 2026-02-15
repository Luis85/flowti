---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
priority: low
stage: draft
userStories:
  - "[[I want to import an Obsidian Canvas to add its content to my domain]]"
  - "[[How to prepare data in an ETL pipeline for LLM ingestion]]"
useCases:
  - "[[Clean and Transform Data]]"
  - "[[Orchestrate Multi-Import Pipelines]]"
---

## User Story

As a power user, I want advanced data workflows including multi-import pipelines, Canvas-to-domain import, and ETL pipelines for LLM ingestion so that I can automate complex data transformations and onboard non-CSV content into my vault's domain model.

## Functional Requirements

- [x] Column mapping supports renaming, excluding, and adding custom frontmatter fields during import
- [x] Preview step shows exact YAML frontmatter output before committing the import
- [x] Hub Pipelines tab for creating, editing, and running multi-import pipelines
- [x] Pipeline execution runs steps sequentially with per-step progress and completion summary
- [ ] Canvas import: parse `.canvas` JSON, extract nodes and edges, create domain notes from canvas content
- [ ] Canvas-to-domain mapping: convert canvas groups to domains, cards to events or entities
- [ ] ETL pipeline configuration: define source, transform steps, and LLM-ready output format
- [ ] Transform step library: split, merge, filter, enrich, and template operations on imported data

## Acceptance Criteria

- [x] Column mapping produces clean frontmatter with renamed headers and excluded columns
- [x] Multi-import pipelines execute all steps in order with accurate result reporting
- [ ] Canvas import creates structured notes from `.canvas` file nodes
- [ ] ETL pipeline produces output suitable for LLM context ingestion
- [x] `npm run build` passes
