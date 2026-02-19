---
type: TechDebt
severity: low
category: documentation
layer: flows
status: resolved
effort: small
updated: 2026-02-19
resolved: 2026-02-19
description: Flow docs do not link back to the ADRs and TDs that influenced their design, making it hard to trace decisions to implementations.
---
# TD-98: Flow docs lack ADR and TD cross-references

## Problem

The 11 existing flow docs in `docs/flows/` describe event sequences and user journeys but do not reference the architectural decisions (ADRs) or technical debt items (TDs) that influenced their design. For example:

- The Import CSV Data flow doesn't reference ADR-023 (Modal Business Logic Extraction) despite the import pipeline being restructured by that decision
- The Subscribe to Events flow doesn't reference TD-90 (manually maintained catalog)
- No flow doc references any learning (L-XX) documents

This makes it impossible to trace from "what happens" (flows) back to "why it works this way" (ADRs/TDs).

## Impact

- Decision rationale is disconnected from implementation documentation
- Code archaeologists must search ADRs manually to find relevant context
- Tech debt items affecting flows are not discoverable from the flow docs

## Suggested Remediation

1. Add a "Related Decisions" section to each flow doc listing relevant ADRs
2. Add a "Known Debt" section listing relevant TDs
3. Add a "Learnings" section where applicable
4. Template update: add these sections to the flow doc template

## Resolution (2026-02-19)

All 15 flow docs now include "Related Decisions", "Known Debt", and "Learnings" sections:
- 13 flow docs already had all three sections (added during various cycles)
- **Run Intentional Session.md** — added "Known Debt" and "Learnings" sections (had only "Related Decisions")
- **Monitor Session from Sidebar.md** — added all three sections (was missing entirely)
- **Manage Inbox Notifications.md** — created with all sections from the start

## Related

- All 15 flow docs in `docs/flows/`
- 32 ADRs in `docs/decisions/`
- 101 TDs in `docs/debt/`
