---
type: TechDebt
severity: high
category: architecture
layer: cross-cutting
status: open
effort: large
updated: 2026-02-15
description: Approximately 40% of markdown documentation files lack the type frontmatter field, preventing automated cataloging, self-documentation, and consistent database view filtering.
---
# TD-85: ~40% of documentation files lack `type:` frontmatter

## Problem

The documentation system is designed to be self-documenting: the Event Catalog scans files for `type:` frontmatter to discover and catalog entities. The Data Dictionary defines 16+ document types, each with expected frontmatter schemas.

However, approximately 135 of 258 markdown files (~40%) lack the `type:` field entirely. The breakdown:

**Areas with excellent type compliance (90–100%):**
- Components (58 files — all have `type: Component`)
- Flows (11 files — all have `type: Flow`)
- Decisions (23 files — all have `type: DecisionNote`)
- Sitemap (6 files — all have `type: View`)

**Areas with poor or missing type compliance:**
- Feature subdirectory files (PRDs, backlogs, problemspaces) — inconsistent
- Jobs to Be Done — 19/20 stubs lack body content but do have type
- User Stories — inconsistent
- Top-level architecture docs (Backend Architecture, Frontend Architecture) — no `type:` field
- Debt items — no `type:` field (using implicit file naming convention instead)
- Knowledgebase articles — no `type:` field

Without `type:`, files cannot be:
- Auto-discovered by the catalog scanning system
- Filtered in `.base` database views
- Validated against their corresponding template schema

## Impact

- Self-documentation is incomplete — the system cannot catalog 40% of its own content
- Database views return partial results — users see incomplete inventories
- Template conformance cannot be verified — no way to check if a file matches its expected shape
- The "living organism" goal requires every document to be typed and discoverable

## Suggested Remediation

1. Define canonical `type:` values for currently untyped document categories:
   - Architecture docs → `type: ArchitectureDoc`
   - Debt items → `type: TechDebt`
   - Knowledgebase articles → `type: KnowledgeBase`
   - Problemspace files → `type: Problemspace`
   - Solutionspace files → `type: Solutionspace`
2. Add `type:` frontmatter to all untyped files in a systematic sweep
3. Update the Data Dictionary with these new type definitions and their schemas
4. Consider a frontmatter linting step that flags files missing required fields

## Affected Files

- ~135 files across multiple directories (feature subdirectories, architecture docs, debt items, knowledgebase)
