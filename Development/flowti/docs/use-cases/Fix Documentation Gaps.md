---
type: UseCase
domain: Flowti
stage: done
description: "Use the Health tab to identify undocumented domains and services, then navigate directly to each entity to create its documentation file."
view: "[[Event Catalog View]]"
feature: "[[Vault Health Dashboard]]"
testplanRef: "UC-94"
tags:
  - use-case
  - catalog
  - health
---

# Fix Documentation Gaps

## Summary

A user notices the Documentation Coverage check is failing in the Health tab. They drill into the affected items list, identify which domains and services lack doc files, and navigate to each one to create the missing documentation.

## Preconditions

- The Health tab shows a non-passing Documentation Coverage check.
- At least one domain or service has `filePath === null` (undocumented).

## Steps

1. **Open the Health tab** — The user navigates to the Health tab in the Event Catalog.
2. **Select "Documentation Coverage"** — The user clicks the Documentation Coverage check row in the Documentation category group. The detail panel shows the check summary (e.g., "3 / 8 entities documented"), a progress bar, and the list of affected items.
3. **Review affected items** — Each item shows the entity name, reason (e.g., "No domain doc file" or "No service doc file"), and entity type.
4. **Navigate to an undocumented domain** — The user clicks the name of an undocumented domain (e.g., "Subscription"). The view navigates to the Domains tab with that domain selected.
5. **Create the documentation** — In the Domains tab detail panel, the user clicks "Create Doc" in the actions section. A DomainDoc markdown file is created in the appropriate folder with standard frontmatter.
6. **Return to Health tab** — The user clicks back to the Health tab. The system re-scans all entities and recomputes health checks. The Documentation Coverage score has increased, and the fixed domain no longer appears in the affected items list.
7. **Repeat for remaining items** — The user repeats steps 3–6 for each undocumented service, improving the score incrementally.

## Outcome

All domains and services now have documentation files. The Documentation Coverage check shows "pass" severity with a 100% score. The overall vault health score has improved.

## Variations

- **Service documentation**: Clicking an undocumented service navigates to the Services tab, where the same "Create Doc" action is available.
- **System entities hidden**: If `showSystemEvents` is disabled, system domains and services are excluded from the check. Enabling system events in settings reveals additional undocumented entities.

## Related

- View: [[Event Catalog View]]
- Feature: [[Vault Health Dashboard]]
- Test: UC-94 in [[Testplan and Teststrategy]]
