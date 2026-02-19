---
type: TechDebt
severity: high
category: documentation
layer: flows
status: resolved
effort: small
updated: 2026-02-19
resolved: 2026-02-18
description: Export Vault Data flow doc references dataExchange.export.progress which does not exist in the event catalog.
---
# TD-97: Stale event reference in Export Vault Data flow

## Problem

The flow document `docs/flows/Export Vault Data.md` references the event `dataExchange.export.progress` in its event sequence. This event does not exist in the event catalog (`src/infrastructure/events/catalog.ts`).

The import flow has a progress event (`dataExchange.import.progress`) but the export flow uses a simpler pattern: `dataExchange.export.started` → `dataExchange.export.completed` / `dataExchange.export.failed`. No progress event was ever implemented for export.

## Impact

- Flow doc contains incorrect event reference
- Developers following the flow doc would expect a progress event that doesn't exist
- Misleading documentation undermines trust in all flow docs

## Suggested Remediation

1. Replace `dataExchange.export.progress` with `dataExchange.export.started` in the Export flow doc
2. Verify all other event references in flow docs against the catalog
3. Consider adding a CI check that validates event references in flow docs (future)

## Resolution (2026-02-18)

The Export Vault Data flow doc was corrected during Cycle 8 — `dataExchange.export.progress` removed from the event sequence, replaced with the correct `dataExchange.export.started → dataExchange.export.completed` pattern. The Known Debt section of the flow doc self-documents this fix.

## Related

- [[Export Vault Data]] (flow doc)
- TD-98: Flow docs lack ADR/TD cross-references
