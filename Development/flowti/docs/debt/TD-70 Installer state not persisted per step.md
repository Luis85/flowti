---
type: TechDebt
severity: medium
category: reliability
layer: domain
status: resolved
resolved_in: "Cycle 10 Inc 6"
created: 2026-02-15
effort: small
description: "InstallerService.saveState() is only called after all steps succeed. If the plugin crashes between steps, completedSteps progress is lost."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-70: Installer state not persisted per step

## Problem

`InstallerService` updates `completedSteps` in memory during the step execution loop, but `saveState()` is only called once after all steps have completed successfully. If the plugin crashes or Obsidian is closed between steps, the in-memory progress is lost and the installer restarts from scratch on next launch.

```
for (step of steps) {
    await step.execute(context, deps);
    this.completedSteps.push(step.id);  // in-memory only
}
await this.saveState();  // only here
```

## Impact

- Multi-step installer loses all progress on crash or unexpected shutdown.
- Steps re-run from the beginning. While steps are designed to be idempotent, users see no progress and may be confused.
- For steps that perform external API calls or long operations (future extensibility), re-running is wasteful.

## Suggested Fix

Call `saveState()` after each successful step completion:

```typescript
for (const step of steps) {
    await step.execute(context, deps);
    this.completedSteps.push(step.id);
    await this.saveState();  // persist after each step
}
```

This is a one-line move with no architectural change. The overhead of an extra storage write per step is negligible given the installer runs once.

## Affected Files

- `src/domain/installer/InstallerService.ts` (lines 140-149)
