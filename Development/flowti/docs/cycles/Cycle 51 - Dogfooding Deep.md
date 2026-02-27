---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: planning
cycle: 51
release_anchor:
  - "Theme 2: Dogfooding — Flowti Builds Flowti"
pbis:
  - "PBI-DOG-001: Auto-generate cycle reports"
  - "PBI-DOG-002: Idea-to-solution traceability"
  - "PBI-DOG-003: Auto-document commands"
  - "TD-90: Event Catalog auto-generation"
bugs: []
tech_debt:
  - TD-90
estimated_increments: 6
---

# Cycle 51 — Dogfooding Deep

## Release Anchor Theme

- **Theme 2: Dogfooding — Flowti Builds Flowti** — Prove the product by using it. Every gap discovered is a gap users would hit.

## Cycle Overview

Cycle 51 turns the development process into Flowti's primary testbed. If Flowti can't manage its own development lifecycle — tracking ideas from inbox to delivered features, auto-generating cycle reports, documenting its own commands, and keeping its event catalog current from source — it can't do it for anyone else.

This cycle builds on the report ingestion infrastructure from C49 and the Command Catalog from C50 to create a self-documenting, self-tracking development engine.

## User Pains

1. **Cycle reports are manually written** — After every cycle, metrics are hand-copied into documents. This is error-prone and time-consuming.
2. **No traceability from idea to delivered feature** — 149 inbox items exist but there's no way to trace a delivered feature back through increments, PRDs, and the original inbox idea.
3. **Command documentation is separate from code** — Commands are registered in TypeScript but documented in markdown. They drift (TD-90 related).
4. **Event Catalog is manually maintained** — 598 lines, 136 events, manually kept current. 9 phantom events found in PRD audit (TD-90). Data Dictionary (541 lines) also manual.

## Cycle Goals

1. **Auto-generate cycle reports** from git commits, test results, and cycle metadata
2. **Build idea-to-solution traceability** — link inbox items → PBIs → increments → delivered features
3. **Auto-document commands** from CommandRegistry metadata (built in C50)
4. **Auto-generate Event Catalog and Data Dictionary** from TypeScript source (TD-90)

## Scope

### In Scope
- PBI-DOG-001: Cycle report auto-generation (git log + test metrics + cycle frontmatter)
- PBI-DOG-002: Traceability links (inbox → PBI → increment → feature, bidirectional)
- PBI-DOG-003: Command reference auto-generation from CommandRegistry
- TD-90: Event Catalog + Data Dictionary generation from `catalog.ts` and frontmatter schemas

### Out of Scope
- AI-assisted report generation (manual template + auto-fill only)
- Traceability UI visualization (links only, no graph view)
- Documentation hosting or publishing (vault-only)
- Git history visualization (timeline views deferred)

## Increments

### Inc 1: Cycle Report Auto-Generation (PBI-DOG-001)
**Theme**: Dogfooding
**Effort**: Medium

Auto-generate a cycle report note after cycle completion:
- Parse cycle document frontmatter (pre/post test counts, increments, PBIs, debt resolved)
- Extract git commit log for cycle date range
- Calculate delta metrics (tests added, files changed, LOC delta)
- Generate structured markdown report note in `docs/reports/cycles/`
- Emit `docs.report.generated` event

**Acceptance Criteria**:
- [ ] Report note auto-generated from cycle metadata + git log
- [ ] Frontmatter contains queryable metrics (cycle, tests_added, files_changed, increments, debt_resolved)
- [ ] Commit summary grouped by increment
- [ ] Report stored in `docs/reports/cycles/Cycle {N} Report.md`
- [ ] Event emitted on generation
- [ ] Unit tests for report generation logic
- [ ] `npm test` green

### Inc 2: Traceability Data Model (PBI-DOG-002a)
**Theme**: Dogfooding
**Effort**: Medium

Define and implement the traceability link model:
- `TraceLink` interface: `{ source, target, type, direction }`
- Link types: `idea-to-pbi`, `pbi-to-increment`, `increment-to-feature`, `feature-to-delivery`
- TraceLinkService: resolve links from frontmatter `[[wikilinks]]` and explicit `trace` properties
- Index builder: scan inbox, PBI, increment, and feature documents to build link graph

**Acceptance Criteria**:
- [ ] TraceLink interface and types defined
- [ ] TraceLinkService resolves forward and backward links
- [ ] Index builder produces complete link graph from existing documents
- [ ] Unit tests for link resolution and graph building
- [ ] `npm test` green

### Inc 3: Traceability Query & Display (PBI-DOG-002b)
**Theme**: Dogfooding
**Effort**: Medium

Expose traceability through queries and UI:
- Add `trace.query` event: given a document, return its full trace chain (idea → ... → delivery)
- Display trace chain as breadcrumb in document context (e.g., callout block)
- Analytics query support: "show all ideas that reached delivery" / "show orphaned PBIs"
- Integrate with Analytics Hub as queryable data source

**Acceptance Criteria**:
- [ ] Trace chain queryable via event
- [ ] Breadcrumb display in relevant documents
- [ ] Analytics queries can filter by trace status
- [ ] Unit tests for trace queries
- [ ] `npm test` green

### Inc 4: Command Reference Auto-Generation (PBI-DOG-003)
**Theme**: Dogfooding
**Effort**: Small

Auto-generate a command reference document from CommandRegistry:
- Read all CommandMeta from registry (built in C50 Inc 1)
- Generate `docs/reference/Command Reference.md` with table: command, description, domain, shortcut
- Group by domain, alphabetical within groups
- Add to build pipeline (regenerate on `npm run build`)
- Emit `docs.reference.generated` event

**Acceptance Criteria**:
- [ ] Command Reference generated from registry metadata
- [ ] Grouped by domain with descriptions and shortcuts
- [ ] Regenerated on build
- [ ] Matches actual registered commands (no drift possible)
- [ ] Unit tests for generation logic
- [ ] `npm test` green

### Inc 5: Event Catalog Auto-Generation (TD-90a)
**Theme**: Dogfooding
**Effort**: Large

Auto-generate Event Catalog from TypeScript source:
- Parse all `events.ts` files in `src/domain/*/events.ts` and `src/infrastructure/events/events.ts`
- Extract event names, types, payloads, and JSDoc descriptions
- Generate `docs/reference/Event Catalog.md` (replacing manual version)
- Include: event name, domain, payload type, description, system tag
- Validate: no phantom events (events in docs but not in code)

**Acceptance Criteria**:
- [ ] Event Catalog generated from TypeScript event map interfaces
- [ ] All 136+ events documented with domain, payload, description
- [ ] Phantom event detection (events in docs not in code, or vice versa)
- [ ] Replaces manual `Event Catalog.md`
- [ ] Added to build pipeline
- [ ] Unit tests for parser and generator
- [ ] `npm test` green

### Inc 6: Data Dictionary Auto-Generation (TD-90b)
**Theme**: Dogfooding
**Effort**: Medium

Auto-generate Data Dictionary from frontmatter schemas:
- Scan entity type definitions and Zod schemas in codebase
- Extract field names, types, descriptions, defaults, constraints
- Generate `docs/reference/Data Dictionary.md` (replacing manual version)
- Include: entity type, field, type, required, default, description
- Cross-reference with Event Catalog (which events touch which entities)

**Acceptance Criteria**:
- [ ] Data Dictionary generated from schemas and type definitions
- [ ] All 16+ document types documented with fields and constraints
- [ ] Cross-references to Event Catalog
- [ ] Replaces manual `Data Dictionary.md`
- [ ] Added to build pipeline
- [ ] Unit tests for schema parser and generator
- [ ] `npm test` green

## Dependency Graph

```
Inc 1 (Cycle Reports)       ──→ Independent
Inc 2 (Trace Model)         ──→ Inc 3 (Trace UI)
Inc 4 (Command Ref)         ──→ Depends on C50 Inc 1 (CommandMeta)
Inc 5 (Event Catalog Gen)   ──→ Independent
Inc 6 (Data Dictionary Gen) ──→ Can reference Inc 5 output
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TypeScript event parsing is complex (generics, extends, mapped types) | High | Start with simple interface extraction; handle complex cases incrementally |
| Traceability requires consistent frontmatter across 100+ documents | Medium | Define required properties; run conformance check first |
| Generated docs diverge from manual quality | Medium | Use manual docs as template; preserve formatting conventions |
| Build pipeline slows down with generation steps | Low | Only regenerate on production build, not dev watch |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~70 |
| Post-cycle tests | ~5,585 |
| Auto-generated docs | 4 (Cycle Report, Command Ref, Event Catalog, Data Dictionary) |
| Manual docs replaced | 2 (Event Catalog, Data Dictionary) |
| Phantom events detected | 0 (all events match source) |
| Tech debt resolved | TD-90 |
| Increments | 6 |

## Deferred Items

- Git history timeline views → beyond C55
- AI-assisted report summarization → beyond C55
- Traceability graph visualization → future cycle
- Auto-generate domain documentation (TD-78) → C55 stretch goal
