---
type: TechDebt
severity: high
category: documentation
layer: cross-cutting
status: open
effort: large
updated: 2026-02-15
description: 19 of 20 Jobs to Be Done files contain only frontmatter with no body content — no scope, no form, no feature links. Only the Testsuite JTBD is complete.
---
# TD-80: 95% of Jobs to Be Done are empty stubs

## Problem

The `/docs/jobs to be done/` directory contains 20 files. Only 1 has meaningful body content:

**Complete (1/20):**
- "I need to create and manage a Testsuite for my domain.md" — has scope, form, feature link

**Empty stubs (19/20):**
- I need to design a flow.md
- I need to design something.md (also has malformed frontmatter — uses `domain:` and `domains:` instead of `type: Job to be Done`)
- I need to document Requirements.md
- I need to document System Design decisions.md
- I need to manage a product backlog.md
- I need to manage a product.md
- I need to manage a project.md
- I need to structure and manage my researched Jobs to be done.md
- I need to trace my solutions back to the problem.md
- (and 10 more)

All stub files have frontmatter (`persona`, `type`) but zero body content — no scope, no form definition, no feature cross-references.

Additionally, no JTBD Template exists in `/docs/templates/`. The single complete file shows the expected structure (scope bullets, form description, feature link) but this pattern is not codified.

## Impact

- Jobs to Be Done cannot guide feature prioritization — they contain no actionable information
- The "living organism" goal fails here — these stubs are dead-on-arrival, not living documents
- Feature-to-need traceability is broken — features cannot be justified against user jobs
- Persona-to-job mapping is incomplete — personas reference jobs that have no content
- Product Service Book Chapter 3 and Domain Book Chapter 3 cannot be compiled

## Suggested Remediation

1. Create a JTBD Template in `/docs/templates/` codifying the structure from the one complete example: frontmatter (persona, type, tags), feature link, scope section, form section
2. Populate the 19 stub files — at minimum add scope bullets and a feature cross-reference
3. Fix malformed frontmatter in "I need to design something.md"
4. Verify all referenced personas exist in `/docs/personas/` (they currently do not — see TD-79)

## Affected Files

- 19 stub files in `docs/jobs to be done/`
- `docs/jobs to be done/I need to design something.md` (malformed frontmatter)
- Missing: `docs/templates/JTBD Template.md`
