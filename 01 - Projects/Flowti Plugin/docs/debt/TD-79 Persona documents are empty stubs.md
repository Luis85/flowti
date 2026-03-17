---
type: TechDebt
severity: high
category: documentation
layer: cross-cutting
status: resolved
effort: medium
updated: 2026-02-22
resolved: 2026-02-22
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

## Resolution (2026-02-22)

All 9 persona files now have full content following the Persona Template structure:

1. **Strategic Systems Builder** — primary persona, comprehensive (15 domains, 10 features, 9 JTBDs)
2. **The Product Owner (Operational Strategist)** — enriched with delivered feature context
3. **Developer (Execution Specialist)** — updated with session-driven development workflow
4. **System Designer** — expanded from stub to full persona with 7 goals, 6 pain points
5. **Knowledge Worker** — written from scratch (was empty stub)
6. **Citizen Developer** — expanded with guided wizard emphasis
7. **Software Architect** — updated with Event Catalog domain contract focus
8. **Delivery Manager (Systems Orchestrator)** — updated with Signal sync + "not yet delivered" section
9. **The Integration Node** — kept as Actor type, expanded with delivered system tables

All personas now include: Identity (name, archetype, quote, profile summary), Goals & Motivations (table), Pain Points (table with severity + Flowti feature), Domain Interaction Map, Related Artifacts (JTBDs + features). Persona Template was already created in a prior cycle.

Referenced personas in JTBDs (Product Owner, Product Manager) now resolve to actual persona files via wikilinks.
