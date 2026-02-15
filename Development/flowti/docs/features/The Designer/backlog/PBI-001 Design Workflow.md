---
type: ProductBacklogItem
feature: "[[The Designer PRD]]"
priority: low
stage: draft
userStories:
  - "[[How can I use Obsidian and Flowti to document a Prototype from first idea onward]]"
useCases: []
---

## User Story

As a system designer, I want a structured workflow in Obsidian and Flowti that guides me from an initial idea through domain modelling, event discovery, flow design, and system documentation so that I can document a prototype end-to-end without leaving the vault.

## Functional Requirements

- [ ] "New Design" command or modal that scaffolds a design project with linked notes (Idea, Domains, Events, Flows, Systems)
- [ ] Idea capture template with problem statement, goals, and initial domain brainstorm
- [ ] Domain modelling step: create DomainDoc notes linked to the design project
- [ ] Event discovery step: identify key events per domain, register them in the catalog
- [ ] Flow authoring step: compose FlowDoc notes that reference discovered events and domains
- [ ] System composition step: group domains and services into SystemDoc notes
- [ ] Design overview note with cross-references to all created artifacts

## Acceptance Criteria

- [ ] A designer can start a new design project from a single command
- [ ] Scaffolded notes follow existing doc types (DomainDoc, FlowDoc, SystemDoc)
- [ ] Each step produces vault notes with valid frontmatter and cross-references
- [ ] The design overview links to all related domains, events, flows, and systems
- [ ] Created artifacts appear in their respective Event Catalog tabs
- [ ] Workflow is non-destructive and can be resumed after interruption
