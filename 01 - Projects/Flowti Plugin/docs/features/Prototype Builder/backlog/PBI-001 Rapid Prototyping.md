---
type: ProductBacklogItem
feature: "[[Prototype Builder PRD]]"
priority: low
stage: draft
userStories:
  - "[[I want to build a prototype]]"
useCases: []
---

## User Story

As a maker, I want to rapidly build a working prototype from within my Obsidian vault so that I can go from concept to runnable code without switching tools or losing context.

## Functional Requirements

- [ ] "New Prototype" command or modal that scaffolds a prototype project folder with boilerplate files
- [ ] Template selection: choose from available prototype templates (plugin, script, component)
- [ ] Auto-generated `package.json`, entry point, and minimal build configuration
- [ ] Link prototype project to existing design docs (domains, flows, events) via frontmatter
- [ ] In-vault build and run: execute prototype build scripts from Obsidian
- [ ] Prototype status tracking: draft, building, testing, complete

## Acceptance Criteria

- [ ] A user can create a new prototype project from a command or modal
- [ ] Scaffolded project contains valid boilerplate that builds without errors
- [ ] Prototype is linked to related design documentation in the vault
- [ ] Build scripts can be executed from within Obsidian with output displayed
- [ ] Multiple prototypes can coexist in the same vault without conflict
- [ ] `npm run build` passes
