---
type: DecisionNote
adr: ADR-030
title: Frontmatter Type Conformance Standard
status: Proposed
date: 2026-02-18
domain: documentation
category: Process
drivers:
  - Consistency
  - Dataview Compatibility
  - Automated Queries
tags:
  - decision
  - documentation
  - process
  - frontmatter
---

# ADR-030: Frontmatter Type Conformance Standard

## Status

**Proposed** — identified during documentation audit (2026-02-18).

## Context

A full documentation audit of 534 docs across 159 directories revealed that 105 docs (19.6%) lack a `type:` frontmatter field. The breakdown:

| Category | Count Missing | Total | % Missing |
|----------|--------------|-------|-----------|
| ADRs (`docs/decisions/`) | 29 | 29 | 100% |
| TDs (`docs/debt/`) | 93 | 93 | 100% |
| Feature roots | 5 | 33 | 15% |
| Other (misc docs) | ~8 | ~50 | ~16% |

Additionally, 28 feature root docs lack a `stage:` field, making lifecycle tracking impossible via Dataview.

### Why This Matters

- **Dataview queries** rely on `type:` to filter documents (e.g., "show all TechDebt items")
- **Automated tooling** (linters, frontmatter normalizers) cannot validate docs without type metadata
- **Navigation patterns** in the Event Catalog depend on `type:` for entity scanning
- **Cross-referencing** is weakened when doc types can't be programmatically determined

### The Question: Convention or Enforcement?

Two approaches were considered:

1. **Convention only**: Document the requirement, rely on authors to add `type:` manually
2. **Convention + Script**: Document the requirement AND provide an idempotent script to fix existing violations and catch future drift

## Decision

**Convention + Script.** All documentation files MUST have a `type:` frontmatter field. An idempotent Node.js script (`scripts/fix-frontmatter.mjs`) will:

1. Add `type: DecisionNote` to all ADRs
2. Add `type: TechDebt` to all TDs
3. Add `stage:` to feature root docs based on maturity signals
4. Be safe to re-run (idempotent — skips files that already conform)

### Canonical Type Values

| Document Category | `type:` Value | Location |
|-------------------|---------------|----------|
| ADRs | `DecisionNote` | `docs/decisions/` |
| Tech Debt | `TechDebt` | `docs/debt/` |
| Learnings | `Learning` | `docs/learnings/` |
| PRDs | `ProductRequirementsDocument` | `docs/features/*/` |
| PBIs | `ProductBacklogItem` | `docs/features/*/backlog/` |
| Increments | `Increment` | `docs/features/*/increments/` |
| Flow docs | `Flow` | `docs/flows/` |
| TASM reviews | `ThreeAmigosReview` | `docs/reviews/` |
| Knowledgebase | `KnowledgeBase` | `docs/knowledgebase/` |
| User Stories | `UserStory` | `docs/inbox/` |
| Personas | `Persona` | `docs/personas/` |
| JTBDs | `JTBD` | `docs/jtbd/` |
| Domains | `Domain` | `docs/domains/` |

### What Was Deferred

- **CI enforcement**: A pre-commit hook or CI check that rejects docs without `type:`. Not needed until the team grows beyond 1 contributor.
- **Schema validation**: Full JSON Schema for each doc type's required fields. Overkill at current scale.

## Consequences

### Positive

- **100% type coverage** after script runs — all 534+ docs have `type:` metadata
- **Dataview queries work reliably** across all document categories
- **New docs follow convention** with clear canonical values table above
- **Script is re-runnable** — safe to include in CI later if needed

### Negative

- **Script maintenance**: If new document categories are added, the script must be updated
- **Type renaming risk**: If canonical type values change, a migration is needed

### Neutral

- **No runtime impact**: Frontmatter metadata is documentation-only, not consumed by plugin code

## Files

| File | Change |
|------|--------|
| `scripts/fix-frontmatter.mjs` | NEW — idempotent frontmatter fix script |
| `docs/decisions/ADR-030 ...` | NEW — this decision |
| ~150 docs | MODIFIED — `type:` field added by script |

## Related

- Documentation Audit (2026-02-18): identified the 105-doc gap
- TD-82: Feature docs missing `stage:` field
- [[Development Lifecycle]] (Phase 9: Documentation)
