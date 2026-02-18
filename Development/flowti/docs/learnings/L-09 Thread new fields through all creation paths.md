---
type: Learning
id: L-09
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 4
domain: architecture
tags:
  - learning
  - architecture
  - checklist
---

# L-09: Thread new fields through all creation paths

When `focusFile` was added (Inc 4), it required changes in `handleCreate()`, `rerunSession()`, `createFromTemplate()`, and `saveTemplateFromSession()`. This 4-method threading pattern recurs for every new Session field — a checklist for future additions.

## Checklist

When adding a new field to `Session`:
1. `handleCreate()` — accept and set the field
2. `rerunSession()` — copy the field from the source session
3. `createFromTemplate()` — read the field from the template
4. `saveTemplateFromSession()` — save the field to the template
5. `load()` — add backward compatibility migration guard

## When to Apply

- Every time a new field is added to a persisted entity that has multiple creation paths
