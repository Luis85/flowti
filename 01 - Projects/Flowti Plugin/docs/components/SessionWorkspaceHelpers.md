---
type: Component
domain: Flowti
stage: done
description: "Extracted helper functions for workspace state, modal openers, leaf navigation, and status styling"
source: "[[Development/flowti/src/ui/session/SessionWorkspaceHelpers.ts|SessionWorkspaceHelpers.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
  - infrastructure
---

# SessionWorkspaceHelpers

## Description

SessionWorkspaceHelpers is an extracted module containing 9 free functions and a `WorkspaceHelperContext` interface. Extracted from `SessionWorkspaceView` to keep the main view under 450 LOC. Functions cover workspace state capture/restore, modal openers (save template, output picker), leaf navigation (tab, sidebar, adjacent split), and status badge styling.

## Exports

| Export | Type | Purpose |
|--------|------|---------|
| `WorkspaceHelperContext` | interface | Narrow context: `app`, `eventBus`, `leaf`, `getSession()`, `getAdjacentLeaf()`, etc. |
| `getStatusStyle(status)` | function | Returns inline CSS for session status badge colors |
| `captureWorkspaceState(ctx, sessionId)` | async function | Captures open files and active file, emits `session.state.saved` |
| `restoreWorkspaceState(ctx, sessionId, state)` | async function | Reopens saved files, emits `session.state.restored` |
| `openOutputPicker(ctx)` | function | Opens `SessionOutputPickerModal` |
| `openSaveTemplateModal(ctx, session)` | function | Opens `SaveTemplateModal` with session details |
| `openInTab(ctx)` | function | Opens session workspace in a new tab |
| `openInSidebar(ctx)` | function | Opens session workspace in right sidebar |
| `revealInFileExplorer(ctx, path)` | function | Reveals folder in Obsidian file explorer |
| `openInAdjacentLeaf(ctx, path)` | function | Opens file in adjacent split, reusing tracked leaf |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SaveTemplateModal` | class | Modal for saving session as template |
| `SessionOutputPickerModal` | class | Modal for output template selection |
| `VIEW_TYPE_SESSION_WORKSPACE` | constant | View type for workspace leaf creation |
| `SESSION_TYPE_LABELS` | constant | Human-readable session type names |

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.state.saved` | Emitted | After capturing workspace state |
| `session.state.restored` | Emitted | After restoring workspace state |
| `session.output.generate` | Emitted | After output template selection |

## Related

- Parent: [[SessionWorkspaceView]]
- Modals: [[SaveTemplateModal]], [[SessionOutputPickerModal]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
