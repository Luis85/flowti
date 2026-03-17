---
type: Increment
feature:
pbi:
phase: 0
increment: 0
stage: planned  # planned | in-progress | done
date: YYYY-MM-DD
tasm_score: 0
tasm_review: ""
tests_added: 0
tests_total: 0
test_suites: 0
loc_added: 0
---

# Increment N: Title

## Context

Brief description of why this increment exists. What gap does it fill? What does it build on?

## Scope

Summary of what this increment delivers (1-3 sentences).

## Changes

### New Files

- `path/to/new/file.ts` — Brief description

### Modified Files

- `path/to/modified/file.ts` — What changed and why

## Data Model

New types or fields added (if applicable). Use TypeScript interface snippets.

## Events

New events added (if applicable).

| Event | Payload | Direction |
|-------|---------|-----------|
| `domain.event.name` | `{ field: type }` | Command/State |

## Tests

- Test description 1
- Test description 2

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Verification

1. `npm run build` passes
2. Manual verification step
3. Edge case verification

## Notes

Any additional context, decisions, or observations from this increment.
