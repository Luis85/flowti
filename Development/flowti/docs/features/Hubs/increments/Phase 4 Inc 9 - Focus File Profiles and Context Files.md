---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 10
stage: planned
date: 2026-02-16
tasm_score: 0
tests_added: 0
tests_total: 0
test_suites: 0
loc_added: 0
---

# Phase 4, Increment 10: Focus File Profiles & Context Files

> **Note**: Originally planned as Increment 9. Renumbered after [[Phase 4 Inc 8 - Session Workspace Enrichment]] was inserted and Preparation Flow moved to Increment 9. Session Links (from Inc 8) partially overlap with Context Files — `links: SessionLink[]` provides file attachment; Context Files may evolve this into a richer working set.

## Context

Sessions already support a `focusFile` (Increment 4) — a single vault path the user is working on. But all focus files are treated identically regardless of type. A `.canvas` file and a `.csv` file offer fundamentally different affordances, yet the session detail panel shows the same plain link for both.

Additionally, a single focus file is often insufficient. The user needs related files at hand — a PRD while refining a backlog item, a data schema while building an export pipeline, reference images while writing documentation. There is no way to attach these companion files to a session.

This increment adds two capabilities:
1. **Focus File Profiles** — detect the focus file's type and expose a contextual tool palette
2. **Context Files** — attach additional files to a session as the working set

Both are pure domain additions. No new views — the existing `UserHubSessions` detail panel and the future `SessionWorkspaceView` (Inc 7) will consume these.

## Scope

### Focus File Profiles

- `FocusFileCategory` type: `"markdown" | "canvas" | "pdf" | "image" | "csv" | "unknown"`
- `FocusFileTool` interface: `{ id, label, icon, action }` — describes a contextual action
- `FocusFileProfile` interface: `{ extension, category, docType, tools }` — resolved profile for a focus file
- `detectFocusFileCategory(path: string): FocusFileCategory` — pure function mapping extension → category
- `FOCUS_FILE_TOOLS` registry: `Record<FocusFileCategory, FocusFileTool[]>` — static tool definitions per category
- `resolveFocusFileProfile(path: string, frontmatterType?: string): FocusFileProfile` — builds the full profile (extension detection + tool lookup + optional DocType enrichment)
- Markdown enrichment: if frontmatter `type` matches a known DocType (e.g. `EventDoc`, `ServiceDoc`), append domain-specific tools (e.g. "Open in Event Catalog", "Show related Flows")

### Context Files

- `contextFiles: string[]` on `Session` — ordered list of attached file paths
- `contextFiles?: string[]` on `SessionTemplate` — optional, carried through templates
- 4 new events: `session.context.add` / `session.context.remove` (commands) + `session.context.added` / `session.context.removed` (state)
- `handleContextAdd` / `handleContextRemove` on SessionService
- Deduplication: adding an already-attached file is a no-op
- Max context files: `MAX_CONTEXT_FILES = 20`
- Threading: `rerunSession()`, `createFromTemplate()`, `saveTemplateFromSession()` carry context files forward
- Backward compat in `load()`: `s.contextFiles ??= []`

### Out of scope (future increments)

- UI rendering of profiles/tools (Inc 7 or later — SessionWorkspaceView consumes profiles)
- Session Spawning with context file picker (Inc 10)
- Guiding Questions (Inc 10)
- Session Document generation (Inc 11)

## Changes

### New Files

- `src/domain/session/focusFileProfile.ts` (~90 LOC) — `FocusFileCategory`, `FocusFileTool`, `FocusFileProfile` types + `detectFocusFileCategory()`, `resolveFocusFileProfile()`, `FOCUS_FILE_TOOLS` registry
- `tests/domain/session/focusFileProfile.test.ts` (~20 tests) — detection for all 6 categories, tool resolution, DocType enrichment, edge cases (no extension, compound extensions, case-insensitive)

### Modified Files

- `src/domain/session/types.ts` — add `contextFiles: string[]` on `Session`, `contextFiles?: string[]` on `SessionTemplate`, `MAX_CONTEXT_FILES = 20`
- `src/domain/session/events.ts` — add 4 context events to `SessionEventMap`
- `src/domain/session/helpers.ts` — `createSession()` returns `contextFiles: []`
- `src/domain/session/SessionService.ts` — 2 new handlers (`handleContextAdd`, `handleContextRemove`), 2 new event listeners in constructor, backward compat in `load()`, threading in `rerunSession()` / `createFromTemplate()` / `saveTemplateFromSession()`
- `tests/domain/session/SessionService.test.ts` — ~10 new tests (context add/remove/dedupe/max/threading/backward compat)
- `tests/domain/session/helpers.test.ts` — +1 test (createSession includes contextFiles)

## Data Model

### New Types (`focusFileProfile.ts`)

```typescript
type FocusFileCategory = "markdown" | "canvas" | "pdf" | "image" | "csv" | "unknown";

interface FocusFileTool {
  id: string;       // e.g. "open-editor", "show-backlinks", "document-as-md"
  label: string;    // e.g. "Open in Editor", "Show Backlinks"
  icon: string;     // Lucide icon name
  action: string;   // event type or callback identifier
}

interface FocusFileProfile {
  extension: string;            // e.g. ".md", ".canvas", ".csv"
  category: FocusFileCategory;  // resolved from extension
  docType: string | null;       // from frontmatter `type`, if .md
  tools: FocusFileTool[];       // contextual actions for this profile
}
```

### Extension → Category Mapping

| Category | Extensions |
|----------|-----------|
| markdown | `.md` |
| canvas | `.canvas` |
| pdf | `.pdf` |
| image | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp` |
| csv | `.csv` |
| unknown | everything else |

### Tools per Category

| Category | Tools |
|----------|-------|
| markdown | Open in Editor, Show Backlinks, Show Outgoing Links, Show Tags |
| markdown (DocType) | + domain-specific: "Open in Event Catalog", "Show related Flows", etc. |
| canvas | Open Canvas, Show Node Summary |
| pdf | Open PDF Viewer |
| image | Show Preview |
| csv | Open in Table View, Data Exchange Actions |
| unknown | Show File Info, Document as MD |

### Session Changes

```typescript
interface Session {
  // ... existing fields ...
  contextFiles: string[];  // NEW — ordered list of attached file paths
}

interface SessionTemplate {
  // ... existing fields ...
  contextFiles?: string[];  // NEW — optional, carried through templates
}
```

### New Events

```typescript
// Commands
"session.context.add": { sessionId: string; path: string };
"session.context.remove": { sessionId: string; path: string };

// State events
"session.context.added": { sessionId: string; path: string; contextFiles: string[] };
"session.context.removed": { sessionId: string; path: string; contextFiles: string[] };
```

## Verification

1. ~31 tests added (20 profile + 10 context + 1 helper), all existing tests pass
2. `npm run build` passes
3. `detectFocusFileCategory()` correctly maps all documented extensions
4. `resolveFocusFileProfile()` returns enriched tools for DocType markdown files
5. Context files can be added, removed, deduplicated, and capped at MAX_CONTEXT_FILES
6. Context files are carried through rerun, template save, and create-from-template
7. Backward compat: sessions without `contextFiles` get `[]` on load

## Acceptance Criteria

- [ ] `detectFocusFileCategory(path)` returns correct category for all 6 file types
- [ ] `resolveFocusFileProfile(path, frontmatterType?)` returns full profile with tools
- [ ] DocType-aware markdown files include domain-specific tools
- [ ] Unknown extensions return "unknown" category with "Document as MD" tool
- [ ] `session.context.add` attaches a file to the active session's context
- [ ] Adding a duplicate context file is a no-op (no event emitted)
- [ ] `session.context.remove` detaches a file from context
- [ ] Context files capped at `MAX_CONTEXT_FILES` (20)
- [ ] `rerunSession()` carries context files to the new session
- [ ] `createFromTemplate()` carries context files from template
- [ ] `saveTemplateFromSession()` saves context files on template
- [ ] Legacy sessions without `contextFiles` load with `[]`
- [ ] `npm run build` passes
