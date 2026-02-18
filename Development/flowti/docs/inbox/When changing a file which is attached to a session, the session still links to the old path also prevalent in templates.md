---
type: Bug
stage: fixed
origin: inbox
domain: session
parent: "[[Session Workspaces PRD]]"
description: "File rename does not update session paths (focusFile, notesFile, canvasFile, contextBindings, artifacts, templates)."
tags:
  - bug
priority: 2 - high
rank: "0"
fixed_in: "SessionService.handleFileRenamed() + handleFolderRenamed() — Inc 10"
---

**Root cause:** SessionService listened to `file.renamed` but only recorded the rename in the activity log. It did not update stale paths stored in session fields or templates.

**Fix:** Added `handleFileRenamed()` and `handleFolderRenamed()` methods to SessionService that update all path-based fields across all sessions and templates. Follows the proven `ConfigPathTracker` pattern from DataExchangeService.

**Fields covered:** focusFile, notesFile, canvasFile, contextBindings[].path, artifacts[].path, links[].path, activityFilter[], SessionTemplate.focusFile.

**Live UI update:** Both handlers emit `session.paths.updated` with affected session IDs after `saveState()`. SessionWorkspaceView and UserHubView subscribe to this event and re-render immediately — open views reflect the rename without closing and reopening.

**Tests:** 11 path reconciliation tests + 5 event emission assertions in SessionService.test.ts; 2 UI re-render tests in SessionWorkspaceView.test.ts (re-render on match, ignore other sessions).
