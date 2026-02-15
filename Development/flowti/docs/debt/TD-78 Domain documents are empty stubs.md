---
severity: high
category: documentation
layer: domain
status: open
effort: medium
updated: 2026-02-15
description: Both domain files (Business Operations, Supplier Management) are empty stubs with no frontmatter and no content. The Domain Documentation Template exists but is not applied.
---
# TD-78: Domain documents are empty stubs

## Problem

The `/docs/domains/` directory contains 2 files, neither of which follows the Domain Documentation Template:

- **Business Operations.md** — Contains a single question ("What does a Business Operations Specialist need to excell at his job?"). No frontmatter. No structured content. Typo in "excell."
- **Supplier Management.md** — Completely empty (0 lines).

The Domain Documentation Template defines 12 sections covering purpose, responsibilities, boundaries, ownership, core entities, domain events, event flows, external dependencies, documentation artifacts, open questions, review log, and domain maturity scoring. Neither domain file implements any of these sections.

Additionally, the Event Catalog identifies 11 domain services (settings, user, installer, discovery, eventFilter, eventNotify, subscription, ingestion, eventDefinition, dataExchange, docs) — none of which have corresponding domain documentation files.

## Impact

- Domain boundaries are undefined — developers cannot determine what belongs where
- No domain ownership records — accountability is missing
- Domain maturity cannot be scored — the DMI model has nothing to evaluate
- The Domain Book Template cannot be compiled for any domain — no source material exists
- New team members have no entry point for understanding domain responsibilities

## Suggested Remediation

1. Decide which domains are in scope (the 11 service-backed domains from Event Catalog are candidates)
2. Either populate or remove `Business Operations.md` and `Supplier Management.md`
3. Create domain documents from the Domain Documentation Template for each in-scope domain
4. At minimum, populate sections 1–4 (Purpose, Responsibilities, Boundaries, Ownership) for each domain
5. Add proper frontmatter following the template schema

## Affected Files

- `docs/domains/Business Operations.md`
- `docs/domains/Supplier Management.md`
- Missing: domain docs for settings, user, installer, discovery, eventFilter, eventNotify, subscription, ingestion, eventDefinition, dataExchange, docs
