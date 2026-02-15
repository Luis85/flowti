---
severity: low
category: documentation
layer: cross-cutting
status: open
effort: small
updated: 2026-02-15
description: Backend Architecture.md and Frontend Architecture.md lack type frontmatter and updated timestamps, making it impossible to determine document staleness or include them in typed catalog views.
---
# TD-86: Architecture docs lack `type:` and `updated:` fields

## Problem

The two core architecture documents are missing standard metadata:

**Backend Architecture.md** (640 lines, stage: done)
- No `type:` field — cannot be discovered by catalog scanning
- No `updated:` or `created:` timestamp — readers cannot determine if content is current

**Frontend Architecture.md** (814 lines, stage: open)
- No `type:` field
- No `updated:` or `created:` timestamp
- Contains a coherence checklist (78% score) but no date for when it was last evaluated

These are the two largest and most critical reference documents in the system. Both are actively maintained (Frontend Architecture documents refactoring Phases 1–11 with LOC deltas) but neither advertises when it was last updated.

Only `Data Dictionary.md` includes a "Last updated" note (2026-02-14). The other top-level docs (`Development Lifecycle.md`, `Testplan and Teststrategy.md`) also lack timestamps.

## Impact

- Readers cannot assess document freshness — a stale architecture doc is worse than no doc
- Architecture docs are invisible to typed catalog views
- The Architecture Stability Index Template expects dated inputs that these docs do not provide

## Suggested Remediation

1. Add `type: ArchitectureDoc` to Backend Architecture.md and Frontend Architecture.md
2. Add `updated: 2026-02-15` to all top-level docs
3. Consider adding `updated:` to the standard frontmatter schema for all document types

## Affected Files

- `docs/Backend Architecture.md`
- `docs/Frontend Architecture.md`
- `docs/Development Lifecycle.md`
- `docs/Testplan and Teststrategy.md`
