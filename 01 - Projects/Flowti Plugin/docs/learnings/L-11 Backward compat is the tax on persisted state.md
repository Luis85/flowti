---
type: Learning
id: L-11
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 4
domain: infrastructure
tags:
  - learning
  - persistence
  - migration
---

# L-11: Backward compat is the tax on persisted state

Both Inc 4 (`focusFile`) and Inc 5 (`timeline`) needed backward-compat patches in `load()`. Every new field on a persisted entity requires a migration guard. This is a structural cost of using TypedStorage — plan for it.

## Pattern

- Every new field added to a TypedStorage-persisted interface needs a `??=` guard in `load()`
- Example: `session.timeline ??= []` ensures legacy sessions without the field don't crash
- This is a tax, not a bug — budget for it when adding fields

## When to Apply

- Any field addition to `Session`, `SessionState`, `DataExchangeState`, `SubscriptionState`, etc.
- Any TypedStorage entity that may already exist in users' `data.json`
