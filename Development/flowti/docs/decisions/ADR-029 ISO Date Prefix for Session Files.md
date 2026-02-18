---
type: DecisionNote
adr: ADR-029
title: ISO Date Prefix for Session Files
status: Proposed
date: 2026-02-18
domain: session
category: Data Model
drivers:
  - Chronological Organization
  - File Explorer Readability
  - Sorting Consistency
tags:
  - decision
  - data-model
  - session
  - naming
---

# ADR-029: ISO Date Prefix for Session Files

## Status

**Proposed** — not yet implemented.

## Context

Session notes files and canvas files are currently named with the session title and a 6-character ID suffix for uniqueness:

```
03 - Resources/Sessions/Sprint Planning (abc123).md
03 - Resources/Sessions/Sprint Planning (abc123).canvas
```

This naming convention (introduced in Inc 10 for collision prevention) groups files by title, not by date. In practice, the `03 - Resources/Sessions/` folder accumulates files from many days and sessions. Users browsing the folder in Obsidian's file explorer see an alphabetical list that provides no chronological context.

**Note:** This decision applies only to **session notes files** and **session canvas files** — the two file types auto-created by SessionService. It does not apply to session activity log entries, context bindings, or artifacts (which reference existing vault files by path).

### The Question: Should Session Files Include a Date Prefix?

Three naming formats considered:

1. **Current: title + ID** — `Sprint Planning (abc123).md`
2. **ISO date prefix** — `2026-02-18 Sprint Planning (abc123).md`
3. **Full ISO timestamp** — `2026-02-18T10-00 Sprint Planning (abc123).md`

## Decision

**Option 2: ISO date prefix (`YYYY-MM-DD`) before the title.**

```
03 - Resources/Sessions/2026-02-18 Sprint Planning (abc123).md
03 - Resources/Sessions/2026-02-18 Sprint Planning (abc123).canvas
```

### Why Date Prefix Over Other Options

**Chronological sort in file explorer.** ISO 8601 date format (`YYYY-MM-DD`) sorts lexicographically in the correct chronological order. Users see their most recent sessions at the bottom (ascending sort) or top (descending sort) of the folder without needing Dataview queries.

**Why not full timestamp?** The date is sufficient granularity. Users rarely create multiple sessions with the same title on the same day, and the short ID suffix already handles that collision. A full timestamp (`T10-00`) adds visual noise without practical benefit.

**Why not date-only (no ID)?** The short ID suffix remains necessary for:
- Case-insensitive filesystem collisions (`"test"` vs `"Test"` on macOS/Windows)
- Same-title sessions on the same day (rare but possible)

### Format Specification

```typescript
const date = new Date().toISOString().slice(0, 10); // "2026-02-18"
const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
const shortId = id.slice(-6);
session.notesFile = `${SESSION_NOTES_FOLDER}/${date} ${safeName} (${shortId}).md`;
```

### Migration

Existing session files are NOT renamed. The new format applies only to newly created sessions. Existing `notesFile` and `canvasFile` paths in session state remain valid.

## Open Questions

1. **Should the date reflect session creation or the current day?** If a session is created at 11:58 PM and started the next morning, which date should appear?
2. **Canvas file naming parity?** Canvas files are created on-demand (not at session creation). Should they use the session creation date or the canvas creation date?
3. **Path reconciliation impact?** The `handleFileRenamed()` method already handles path updates. No additional logic needed for the new naming convention.

## Consequences

### Positive

- **Chronological browsing** — file explorer shows sessions in date order without plugins
- **Daily grouping** — all sessions from the same day cluster together visually
- **Vault navigation** — users can find "what I worked on last Tuesday" by scrolling to the date
- **Consistent with Obsidian conventions** — many users already prefix daily notes with ISO dates

### Negative

- **Longer file names** — 11 additional characters (`2026-02-18 `) per file
- **Mixed naming** — existing files use old format, new files use new format. No automatic migration.
- **Title truncation** — very long titles combined with date + ID may hit filesystem path limits (unlikely with vault-relative paths)

### Neutral

- **LOC impact** — ~3 LOC change in `SessionService.createSession()` and canvas creation
- **Test impact** — regex-based assertions already handle variable names; date prefix adds a known pattern
- **No event changes** — `session.notesFile.updated` and `session.canvasFile.updated` events unchanged

## Files (Estimated)

| File | Change |
|------|--------|
| `src/domain/session/SessionService.ts` | MODIFY: date prefix in `createSession()` notesFile path |
| `src/ui/SessionWorkspaceView.ts` | MODIFY: date prefix in canvas file creation path |
| `tests/domain/session/SessionService.test.ts` | MODIFY: regex assertions for new path format |

## Related

- ADR-004: Single JSON Blob Storage (session state stores file paths)
- Inc 10: File Collision Fix (introduced short ID suffix)
- PRD: [[Session Workspaces PRD]]
