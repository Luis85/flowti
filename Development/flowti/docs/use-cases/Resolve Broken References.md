---
type: UseCase
domain: Flowti
stage: done
description: "Use the Health tab to find broken cross-references in flow, system, actor, and product docs, then navigate to each entity to fix the frontmatter."
view: "[[Event Catalog View]]"
feature: "[[Vault Health Dashboard]]"
testplanRef: "UC-95"
tags:
  - use-case
  - catalog
  - health
---

# Resolve Broken References

## Summary

A user discovers that the Reference Integrity check is failing in the Health tab. They drill into the affected items to find which entity docs reference non-existent domains, services, or events, then navigate to each entity to correct the frontmatter.

## Preconditions

- The Health tab shows a non-passing Reference Integrity check.
- At least one entity doc contains a reference to a domain, service, or event that does not exist in the catalog.

## Steps

1. **Open the Health tab** — The user navigates to the Health tab in the Event Catalog.
2. **Select "Reference Integrity"** — The user clicks the Reference Integrity check row in the References category group. The detail panel shows the number of broken references and lists each one.
3. **Review broken references** — Each item shows the entity name (e.g., "Order Processing"), the entity type (flow, system, actor, or product), and the reason (e.g., "References unknown domain: Billing").
4. **Navigate to the entity** — The user clicks the entity name (e.g., "Order Processing"). The view navigates to the Flows tab with that flow selected in the detail panel.
5. **Inspect the frontmatter** — The user clicks "Open Doc" in the flow's detail panel to open the markdown file. They locate the incorrect reference in the frontmatter `domains:`, `services:`, or `events:` array.
6. **Fix the reference** — The user corrects the reference — either fixing the spelling, removing the stale entry, or creating the missing domain/service/event first.
7. **Return and verify** — The user returns to the Health tab. The re-scan shows the fixed reference is no longer in the affected items list. The Reference Integrity score has improved.

## Outcome

All cross-references in entity docs resolve to existing catalog entries. The Reference Integrity check shows "pass" severity. The user has confidence that their vault's knowledge graph is consistent.

## Variations

- **Orphaned flows**: If the user also sees the Orphaned Flows check failing, they may need to add the flow's domains or events to a system, actor, or product doc to establish the cross-reference.
- **Multiple broken refs per entity**: An entity may have several broken references. Each appears as a separate item in the affected list with a specific reason.
- **Actor/product references**: Clicking an actor or product item navigates to the Actors or Products tab respectively.

## Related

- View: [[Event Catalog View]]
- Feature: [[Vault Health Dashboard]]
- Test: UC-95 in [[Testplan and Teststrategy]]
