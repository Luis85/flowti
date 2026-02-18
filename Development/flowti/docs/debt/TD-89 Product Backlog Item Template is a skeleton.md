---
type: TechDebt
severity: medium
category: documentation
layer: cross-cutting
status: resolved
effort: small
updated: 2026-02-18
resolved: 2026-02-18
description: The Product Backlog Item Template is 28 lines — a minimal skeleton with section headers only. Other templates average 500+ lines with detailed guidance, examples, and frontmatter schemas.
---
# TD-89: Product Backlog Item Template is a skeleton

## Problem

The Product Backlog Item Template (`docs/templates/Product Backlog Item Template.md`) contains 28 lines with section headers but no guidance:

```
User Story - Problemspace
User Pains
User Needs
Solutionstatement: Use Case
Functional Requirements
Technical Requirements
Constraints
Acceptance Criteria
```

Compare this to other templates in the same directory:

| Template | Lines | Guidance Level |
|----------|-------|---------------|
| PRD Template | 857 | Comprehensive with examples and scoring |
| Three Amigos Session Template | 608 | Full with scoring model |
| Domain Book Template | 656 | Complete with source artifact references |
| Product Service Book Template | 576 | Detailed with audience variants |
| Domain Documentation Template | 339 | Full with maturity model |
| Architecture Stability Index | 314 | Complete with formula and interpretation |
| **Product Backlog Item Template** | **28** | **Headers only** |

The PBI Template is the only template that provides no explanation of what each section should contain, no frontmatter schema, no examples, and no acceptance criteria for the template itself.

Feature backlog directories contain 76+ PBI files across 12 features. Without template guidance, these items vary widely in quality and structure.

## Impact

- Backlog items created from this template are inconsistent — each author interprets the headers differently
- No frontmatter schema means PBI files cannot be queried in database views
- The `07 - Backlog.base` view has no reliable fields to filter on
- Definition of Done for backlog items is undefined

## Suggested Remediation

1. Expand the template with section descriptions, examples, and expected content for each header
2. Add frontmatter schema: `type: ProductBacklogItem`, `feature`, `stage`, `priority`, `effort`, `acceptance_criteria_count`
3. Include guidance on writing testable acceptance criteria
4. Add INVEST criteria checklist (Independent, Negotiable, Valuable, Estimable, Small, Testable)

## Resolution

Resolved 2026-02-18. Template expanded from 28 → 120+ lines with:
1. Full frontmatter schema (`type`, `feature`, `stage`, `priority`, `phase`, `effort`, `dependencies`, `user_story`, `note`, `tags`)
2. Section guidance with descriptions and examples for every section
3. Gherkin scenario template in Use Cases
4. INVEST criteria checklist table
5. Implementation Progress tracking section with per-increment file lists
6. Related section for cross-references

## Affected Files

- `docs/templates/Product Backlog Item Template.md`
