---
type: TechnicalDebt
severity: low
status: open
domain: journey-builder
created: 2026-03-05
identified_in: C55
source: Post-cycle architecture review
tags:
  - architecture
  - ui
  - reuse
---

# TD-132: Shared UI primitives not extracted from JB components

## Description

Cycle 55 produced reusable UI patterns that are currently scoped to `src/ui/journeyBuilder/`:
- **ChipList** (87 LOC) — add/remove string chips, usable for any tag/keyword input
- **EventSuggest** (167 LOC) — fuzzy autocomplete dropdown, usable for any searchable input
- **TemplatePicker** (72 LOC) — card grid with icon/label/desc, usable for any template selection UI

These could serve other domains (Session tags, Train labels, Analytics filters) but are imported from the Journey Builder path.

## Impact

Low — no immediate need. Cross-domain reuse will be blocked by import paths until extraction.

## Suggested Resolution

Move to `src/ui/shared/` when a second consumer emerges. Do not preemptively extract — wait for concrete reuse need. This aligns with TD-53 (shared UI primitive library).

## Related

- TD-53: UI primitives duplicated across components
- [[Cycle 55 - Journey Builder]]
