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
fixed_in: "SessionService.handleFileRenamed() + handleFolderRenamed() — Inc 9 hotfix"
---

**Root cause:** SessionService listened to `file.renamed` but only recorded the rename in the activity log. It did not update stale paths stored in session fields or templates.

**Fix:** Added `handleFileRenamed()` and `handleFolderRenamed()` methods to SessionService that update all path-based fields across all sessions and templates. Follows the proven `ConfigPathTracker` pattern from DataExchangeService.

**Fields covered:** focusFile, notesFile, canvasFile, contextBindings[].path, artifacts[].path, links[].path, activityFilter[], SessionTemplate.focusFile.

**Tests:** 11 new tests in SessionService.test.ts covering file rename, folder rename, multi-session updates, template updates, and non-matching paths.
