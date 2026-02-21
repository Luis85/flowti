---
type: ProductBacklogItem
domain: Signal
feature: "[[Azure DevOps Integration PRD]]"
stage: delivered
delivered_in: "[[Cycle 11 - Azure DevOps Integration]]"
delivered_date: 2026-02-21
actual_loc: 223
actual_tests: 29
priority: 3
cycle: "[[Cycle 11 - Azure DevOps Integration]]"
increment: 3
estimated_loc: 150
estimated_tests: 20
tags:
  - signal
  - mapper
  - pbi
---

# PBI-SIG-003: Work Item Mapping and Note Creation

## Problem Statement

Raw Azure DevOps work item JSON needs to be transformed into vault notes with structured frontmatter. The adapter (PBI-SIG-002) fetches raw data, but a mapping layer is needed to normalize fields, convert HTML descriptions to Markdown, create/update files, and handle conflict resolution.

## Solution Approach

Implement `workItemMapper` in `src/domain/signal/mappers/` with three functions: `mapWorkItem()` (JSON → WorkItemMapping), `toNoteFrontmatter()` (mapping → YAML-safe object), and `toNoteBody()` (HTML → Markdown). Integrate with `FileSystemClient` for note creation/update. Support three conflict strategies: skip, update frontmatter, overwrite.

### HTML → Markdown Conversion

v1 supports a defined subset of HTML elements. This is a deliberate scope limitation — imperfect conversion is acceptable since users can edit notes after sync.

**Supported elements:**

| HTML | Markdown | Notes |
|------|----------|-------|
| `<p>` | Paragraph with blank line | |
| `<br>` / `<br/>` | Newline | |
| `<strong>` / `<b>` | `**bold**` | |
| `<em>` / `<i>` | `*italic*` | |
| `<ul>` + `<li>` | `- item` | Single nesting level |
| `<ol>` + `<li>` | `1. item` | Single nesting level |
| `<a href="...">` | `[text](url)` | |
| `<code>` | `` `code` `` | Inline only |
| `<pre>` | Fenced code block | |
| `<h1>`–`<h6>` | `#` headings | |
| `<img>` | `![alt](src)` | URL only, no download |

**Known limitations (v1):**
- Nested lists render as flat single-level lists
- Tables (`<table>`) are stripped to plain text (no Markdown table conversion)
- Inline styles and CSS classes are silently removed
- `<div>` containers are unwrapped (content preserved, structure lost)
- Embedded images reference external URLs (not downloaded into vault)
- Complex HTML (Azure DevOps rich editor edge cases) may produce imperfect output

## INVEST Assessment

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Independent | Partial | Depends on adapter output format from PBI-SIG-002 |
| Negotiable | Yes | HTML→MD depth, conflict strategy set, frontmatter schema |
| Valuable | Yes | Produces actual vault notes — the tangible output users see |
| Estimable | Yes | ~150 LOC, ~20 tests, ~3 files |
| Small | Yes | Single increment, mapper + file creation |
| Testable | Yes | Pure functions (mapper, converter) + file system mocking |

## Acceptance Criteria

- [x] `mapWorkItem(raw)` correctly extracts fields from Azure DevOps work item JSON (delivered in Inc 2)
- [x] `toNoteFrontmatter()` produces YAML-safe frontmatter with all specified fields (id, type, state, assignedTo, areaPath, iterationPath, priority, tags, url, signalSource, lastSynced)
- [x] `toNoteBody()` converts supported HTML elements to Markdown (see table above)
- [x] All three conflict strategies work: skip (note exists → no-op), update frontmatter (preserve body), overwrite (full replace)
- [x] File names follow pattern: `{workItemId} - {sanitized title}.md` (illegal chars removed, max 80 chars)
- [x] Notes created in configured target folder via `FileSystemClient.createFile()`
- [ ] `signal.item.created` and `signal.item.updated` events emitted per item (deferred to Inc 5 sync orchestration)
- [ ] Known HTML→MD limitations documented in PRD §8 (deferred to Inc 5 wrap-up)
- [x] `npm test` green with 29 tests (2,979 total, 116 suites)

## Test Intent

- Mapping: all Azure DevOps fields extracted correctly, missing fields handled gracefully
- HTML→MD: each supported element, nested lists fallback, table stripping, div unwrapping
- Conflict: skip existing, update frontmatter only, overwrite entire file
- File naming: illegal characters, long titles, empty titles, duplicate IDs
- Events: item.created vs item.updated emission based on conflict outcome

## Documentation Intent

- Update PRD §8 (Architecture) with validated HTML→MD conversion approach
- Document known conversion limitations in PRD

## Related

- [[PBI-SIG-002 Azure DevOps Adapter]] — provides raw work item JSON
- [[PBI-SIG-004 Signal Management UI]] — displays mapped items
- [[Azure DevOps Integration PRD]] — parent PRD (§12)
