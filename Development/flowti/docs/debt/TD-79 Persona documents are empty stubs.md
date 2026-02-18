---
type: TechDebt
severity: high
category: documentation
layer: cross-cutting
status: open
effort: medium
updated: 2026-02-15
description: Both persona files (Citizen Developer, System Designer) contain only partial frontmatter with zero body content. No Persona Template exists to guide creation.
---
# TD-79: Persona documents are empty stubs

## Problem

The `/docs/personas/` directory contains 2 files, both of which are empty stubs:

- **Citizen Developer.md** — Has partial frontmatter (`plugin`, `domain`, `type: Persona`) but zero body content. No description, goals, pain points, or workflows.
- **System Designer.md** — Identical structure to Citizen Developer. Frontmatter only, no body.

There is no Persona Template in `/docs/templates/` to guide how persona documents should be structured. Every other major document type (Domain, Feature/PRD, Flow, Component, Decision) has a corresponding template — personas do not.

Jobs to Be Done files reference personas by name (e.g., `persona: System Designer`), but readers following those links find empty documents with no context about who these users are.

## Impact

- User-centered design decisions have no documented user context
- JTBD and user story prioritization cannot reference persona characteristics
- The Product Service Book and Domain Book templates both call for persona information that does not exist
- PRD "Target Users" sections cannot link to authoritative persona definitions
- New team members cannot understand who they are building for

## Suggested Remediation

1. Create a Persona Template in `/docs/templates/` covering: overview, characteristics, goals, pain points, typical workflows, tools used, quote, related JTBDs, related features
2. Populate both existing persona files using the template
3. Evaluate whether additional personas are needed (JTBD files reference "Product Owner", "Product Manager", "Project Manager", "User" — none have persona docs)
4. Add proper frontmatter including `description`, `stage`, and `tags` fields

## Affected Files

- `docs/personas/Citizen Developer.md`
- `docs/personas/System Designer.md`
- Missing: `docs/templates/Persona Template.md`
- Missing: persona docs for Product Owner, Product Manager, Project Manager (referenced in JTBDs)
