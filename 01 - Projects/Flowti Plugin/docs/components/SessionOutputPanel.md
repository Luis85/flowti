---
type: Component
domain: Flowti
stage: done
description: "Output artifacts list with generate button and clickable file links"
source: "[[Development/flowti/src/ui/session/SessionOutputPanel.ts|SessionOutputPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionOutputPanel

## Description

SessionOutputPanel renders the Output Artifacts section of the Session Workspace. Shows a list of generated output documents (meeting invites, action items, review summaries) with clickable file links. The "Generate Output" button triggers the output template picker modal. Supports incremental refresh via `refreshList()`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `openFile()` |
| `SessionOutputArtifact` | type | Artifact with `path`, `generatedAt` |
| `onGenerate` | callback | Passed in constructor; triggers output template picker |
| `setIcon` | obsidian | Renders file-text and file-output icons |

## State

**Reads via `deps.getSession()`:**
- `outputArtifacts` — array of `SessionOutputArtifact` objects

## Renders

- Header row with "Output Artifacts" label, count badge, and "Generate Output" button
- Artifact rows: file icon + filename link (clickable) + generation date (YYYY-MM-DD)
- Empty state: "No output artifacts generated yet."

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Uses `onGenerate` callback and `deps.openFile()` for navigation |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refreshList()` | Re-render artifact list + update count badge |

## Related

- Parent: [[SessionWorkspaceView]]
- Modal: [[SessionOutputPickerModal]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
