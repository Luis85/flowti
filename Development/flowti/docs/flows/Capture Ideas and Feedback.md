---
type: Flow
domain: Flowti
stage: done
description: One-click note capture via ribbon icons and command palette — create typed notes with frontmatter in a configured folder without leaving the current context
domains:
  - Capture
services:
  - CaptureService
events:
  - capture.idea.created
  - capture.feedback.created
  - capture.note.created
  - ui.openQuickCapture
tags:
  - capture
  - inbox
---

# Capture Ideas and Feedback

## Overview

Quick Capture provides frictionless note creation via seven ribbon icons and eight command palette commands. Each action opens a minimal modal with a title input, optional description textarea, and (when invoked generically) a type selector dropdown with 11 types across 2 groups. On submission, CaptureService creates a note in the configured capture folder with typed frontmatter (type, description, created timestamp, origin) and emits capture events. A Notice confirms "Captured: [title]". The user stays in their current context — no navigation required.

## Trigger

User clicks a ribbon icon (7 icons: Idea, Feedback, Note, Task, Question, Bug, Learning) or invokes a command from the command palette (8 commands: Quick Capture, Add Idea, Add Feedback, Add Note, Add Task, Add Question, Add Bug, Add Learning).

## Steps

### 1. User Initiates Capture

- **View/Service**: main.ts (ribbon icons) or commands/registry.ts (command palette)
- **User Action**: Clicks ribbon icon or invokes command from palette
- **System Response**: The ribbon click handler or command handler emits `ui.openQuickCapture` via EventBus. Ribbon icons emit with a pre-set type (e.g. `{ type: "idea" }`, `{ type: "learning" }`). The "Quick Capture" command emits with no type (`{}`), which triggers the type selector in the modal. All other commands emit with pre-set types, matching their ribbon counterparts.
- **Events**: `ui.openQuickCapture`

### 2. Modal Opens

- **View/Service**: main.ts (event listener) → QuickCaptureModal
- **User Action**: (none — automatic)
- **System Response**: main.ts listens for `ui.openQuickCapture` and opens a `QuickCaptureModal`. If the event payload includes a `type`, the modal pre-selects that type and hides the type selector (`showTypeSelector: false`). If no type is provided (command palette "Quick Capture"), the modal shows a type dropdown (idea, feedback, bug) with `showTypeSelector: true`.
- **Events**: (none — UI display only)

### 3. User Enters Title and Description

- **View/Service**: QuickCaptureModal
- **User Action**: Types a note title in the text input field. Optionally adds a description in the textarea below. Optionally selects a type from the dropdown (if visible).
- **System Response**: The modal captures the title and description values. Input field is full-width for comfortable typing. The modal heading is dynamic: "Capture Idea" when opened from the Idea ribbon, "Capture Learning" from the Learning ribbon, etc. When opened from the generic "Quick Capture" command, the heading reads "Quick Capture".
- **Events**: (none — user input)

### 4. User Submits

- **View/Service**: QuickCaptureModal → CaptureService
- **User Action**: Presses Enter or clicks the "Create" button
- **System Response**: The modal trims the title. If empty after trimming, nothing happens. Otherwise, the modal calls the `onSubmit` callback with a `CaptureInput` object (`{ title, type, description? }`). The modal closes. main.ts forwards the input to `CaptureService.capture()`. If the title is empty after sanitization (e.g. contains only invalid characters), CaptureService throws an error.
- **Events**: (none — callback invocation)

### 5. Note Created

- **View/Service**: CaptureService → FileSystemClient
- **User Action**: (none — automatic)
- **System Response**: CaptureService reads the `captureFolder` setting (default: `00 - Connectivity/inbox`, configurable in Settings > Documentation > "Quick Capture folder"). It sanitizes the title (removes `\/:*?"<>|` characters) and builds the file path: `${captureFolder}/${sanitizedTitle}.md`. It generates frontmatter with the type in title case (e.g., "Idea", "Feedback", "Learning"), optional description, ISO timestamp, and `origin: quick-capture`. FileSystemClient creates the file with `createFolders: true`. A Notice confirms "Captured: [title]".
- **Events**: (none — file I/O)

### 6. Capture Events Emitted

- **View/Service**: CaptureService
- **User Action**: (none — automatic)
- **System Response**: CaptureService emits up to 2 events:
  1. **Type-specific event** (if type is "idea" or "feedback"): `capture.idea.created` or `capture.feedback.created` with `{ path, title }`
  2. **Generic event** (always): `capture.note.created` with `{ path, title, type }`
  These events are fire-and-forget. Downstream listeners (e.g., InboxService when vault folder watching is active) can react to these events.
- **Events**: `capture.idea.created` or `capture.feedback.created` (conditional), `capture.note.created` (always)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Capture type | idea, note, task, question, feedback, bug, learning, risk, assumption, issue, decision, or custom string | "idea" (ribbon) or user-selected (command palette) |
| Target folder | Any vault path | `00 - Connectivity/inbox` (from `captureFolder` setting, configurable) |
| Type selector visibility | Shown when invoked from command palette; hidden when type is pre-set | Depends on invocation source |
| Description | Optional text | Empty |

## Events Sequence

```
[Ribbon click / Command invoke]
    → ui.openQuickCapture { type? }
    → [QuickCaptureModal opens]
    → [User types title + submits]
    → CaptureService.capture()
    → FileSystemClient.createFile()
    → capture.idea.created / capture.feedback.created  (conditional)
    → capture.note.created                              (always)
```

## Frontmatter Template

```yaml
---
type: Idea          # Title case: Idea, Feedback, Bug, Learning, etc.
description: "User-provided description"   # Optional — from textarea
created: 2026-02-21T14:30:00.000Z
origin: quick-capture
---
```

## Capture Actions Summary

| Action | Type | Invocation | Type Selector |
|--------|------|------------|---------------|
| Ribbon: "Add Idea" (lightbulb) | idea | Click sidebar icon | Hidden |
| Ribbon: "Add Note" (file-text) | note | Click sidebar icon | Hidden |
| Ribbon: "Add Task" (check-square) | task | Click sidebar icon | Hidden |
| Ribbon: "Add Question" (help-circle) | question | Click sidebar icon | Hidden |
| Ribbon: "Add Feedback" (message-circle) | feedback | Click sidebar icon | Hidden |
| Ribbon: "Add Bug" (bug) | bug | Click sidebar icon | Hidden |
| Ribbon: "Add Learning" (graduation-cap) | learning | Click sidebar icon | Hidden |
| Command: "Quick Capture" | user-selected | Command palette | Shown (11 types) |
| Command: "Add Idea" | idea | Command palette | Hidden |
| Command: "Add Feedback" | feedback | Command palette | Hidden |
| Command: "Add Note" | note | Command palette | Hidden |
| Command: "Add Task" | task | Command palette | Hidden |
| Command: "Add Question" | question | Command palette | Hidden |
| Command: "Add Bug" | bug | Command palette | Hidden |
| Command: "Add Learning" | learning | Command palette | Hidden |

## Related Decisions

- CaptureService is stateless — no TypedStorage needed, all state lives in the created files
- Type-specific events (`capture.idea.created`, `capture.feedback.created`) exist alongside the generic `capture.note.created` to allow fine-grained subscriptions
- Title case in frontmatter (`Idea`, not `idea`) follows vault convention for note types
- `origin: quick-capture` tag enables downstream systems to identify capture source

## Known Limitations

- No custom capture types in Settings (PBI-QC-001 I-2)
- No navigation option (stay vs. open note) after creation (PBI-QC-001 I-3)
- Obsidian-stub Setting class is a no-op — limits modal UI testability (PBI-QC-001 I-4)

## Related Use Cases

- [[Start a Train of Thoughts]] (train capture uses CaptureService under the hood with `type: "thought"`)
- [[Manage Inbox Notifications]] (capture events can trigger inbox items when vault folder watching is active)
- [[Browse and Configure Events]] (capture events registered in catalog under "Capture" category)
