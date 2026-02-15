---
severity: high
category: architecture
layer: cross-cutting
status: open
effort: medium
updated: 2026-02-15
description: Personas, Jobs to Be Done, and User Stories have no templates in /docs/templates/. These are the only three user-facing doc types without a conforming data shape, causing inconsistent or absent content.
---
# TD-84: Three doc types lack conforming templates

## Problem

The documentation system follows a template-driven approach where each document type has a corresponding template that defines required frontmatter fields, section structure, and content expectations. Seven templates exist:

- PRD Template (features)
- Domain Documentation Template (domains)
- Domain Book Template (books)
- Product Service Book Template (books)
- Product Backlog Item Template (backlog items)
- Three Amigos Session Template (review sessions)
- Architecture Stability Index Template (metrics)

Three document types have **no template**:

1. **Persona** — 2 files exist, both are empty stubs. No defined shape for characteristics, goals, pain points, workflows.
2. **Job to be Done** — 20 files exist, 19 are empty stubs. The one complete file shows an implicit structure (scope, form, feature link) but this is not codified.
3. **User Story** — 5 files exist, all are title-only stubs. No defined shape for acceptance criteria, actor context, business value.

The correlation is clear: document types with templates have consistent, complete content. Document types without templates are overwhelmingly stubs.

## Impact

- The documentation system cannot "guide us to conform data shapes" for these three types — there is no shape to conform to
- Content created for these types will be inconsistent — each author invents their own structure
- Automated tooling (base views, catalog scanning) cannot query fields that are not defined
- The Data Dictionary cannot fully describe these document types without a canonical schema

## Suggested Remediation

1. Create `docs/templates/Persona Template.md` — define frontmatter (type, domain, stage, tags) and sections (overview, characteristics, goals, pain points, tools, workflows, quote, related JTBDs)
2. Create `docs/templates/JTBD Template.md` — define frontmatter (persona, type, stage, feature, tags) and sections (job statement, scope, form, success criteria, feature links)
3. Create `docs/templates/User Story Template.md` — define frontmatter (type, persona, feature, stage, priority) and sections (narrative, acceptance criteria, business value, related features)
4. Update the Data Dictionary with frontmatter schemas for all three types

## Affected Files

- Missing: `docs/templates/Persona Template.md`
- Missing: `docs/templates/JTBD Template.md`
- Missing: `docs/templates/User Story Template.md`
- `docs/Data Dictionary.md` (needs schema additions)
