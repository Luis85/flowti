---
type: TechDebt
severity: high
category: architecture
layer: domain
status: open
created: 2026-02-21
effort: medium
description: "session/helpers.ts is 982 LOC — the largest file in the codebase. It combines session summary generation, reverse parsing, template rendering, duration formatting, and various utility functions into a single module."
domain: session
parent: "[[Session Workspaces PRD]]"
---

# TD-118: session/helpers.ts exceeds 600 LOC with mixed concerns

## Problem

`src/domain/session/helpers.ts` is **982 LOC**, nearly double the project's 600 LOC threshold and the **single largest file in the entire codebase**. It combines at least 5 distinct responsibilities:

1. **Session summary generation** — `generateSessionSummary()`, `generateSessionSummaryBody()` — Markdown output for session documents
2. **Reverse parsing** — `reverseParseSessionNotes()` — parsing session note files back into structured data
3. **Template rendering** — session type templates, guiding questions generation
4. **Duration/time formatting** — `formatDuration()`, `formatTimestamp()`, time calculation helpers
5. **Miscellaneous utilities** — state machine helpers, validation, frontmatter builders

This file grew organically during Cycles 7-9 as session features expanded. The handler extraction (TD-101) reduced `SessionService.ts` but pushed helper logic into this file instead.

## Impact

- Cognitive load: 982 LOC is difficult to navigate and reason about
- Merge conflict surface area with any session-related changes
- Mixed abstraction levels: pure formatters live alongside complex parsing logic
- Test file (`helpers.test.ts`) is correspondingly large at ~85K, making test maintenance difficult

## Suggested Fix

Split into focused modules following the pattern used for `catalog/helpers.ts` (decomposed in TD-01 resolution):

| Module | Responsibility | Est. LOC |
|--------|---------------|----------|
| `helpers.ts` | Barrel re-export | ~30 |
| `summaryGenerator.ts` | `generateSessionSummary()`, `generateSessionSummaryBody()` | ~300 |
| `noteParser.ts` | `reverseParseSessionNotes()` and related parsing | ~200 |
| `templateHelpers.ts` | Session type templates, guiding questions | ~150 |
| `formatters.ts` | Duration, timestamp, and time formatting utilities | ~100 |
| `sessionUtils.ts` | State machine helpers, validation, frontmatter builders | ~200 |

## Related

- [[TD-01 UI files exceed size convention]] — same class of issue, successfully mitigated in UI layer
- [[TD-101 SessionService Handler Extraction]] — the handler extraction that moved logic here
- [[TD-100 Session performance and sync behaviour investigation]]

## Affected Files

- `src/domain/session/helpers.ts` (982 LOC)
- `tests/domain/session/helpers.test.ts` (~85K)
