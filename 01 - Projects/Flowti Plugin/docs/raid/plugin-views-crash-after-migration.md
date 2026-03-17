---
type: RAID
category: issue
severity: critical
status: open
source: increment-review
iteration: 5
date: 2026-03-17
---

# Plugin Views Crash After Migration

## Description

After migrating the Flowti Plugin to be managed by the CLI, plugin views no longer open. They error out with:

```
TypeError: Cannot read properties of undefined (reading 'type')
    at nu.getViewType (plugin:flowti-ibde:533:50675)
```

The error occurs when Obsidian tries to construct the view — `getViewType` references an undefined property, suggesting a registration or initialization ordering issue introduced during the migration.

## Impact

All Flowti Plugin views are non-functional. Users cannot interact with the plugin UI at all.

## Console Observations

- Massive `[Flowti:EventTrace] file.created` / `perf.event.dispatched` event flood during startup
- `simple-git` spawning many git operations in sequence
- `Received CLI command` messages appear, suggesting CLI integration is partially working
- Crash happens on `workspace.leaf-changed` when attempting to open a view

## Suggested Investigation

1. Check view registration order in plugin `main.ts` / setup files
2. Verify `getViewType()` implementation — the `type` property it reads is undefined at construction time
3. May be related to the plugin architecture refactoring (extracted journey wiring, workspace navigation, train wiring, settings tab)
