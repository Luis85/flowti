---
type: TechDebt
severity: low
category: feature-gap
layer: infrastructure
status: open
created: 2026-02-15
effort: small
description: "CommandRegistry only has clear() for bulk removal. Individual command unregistration is impossible, preventing dynamic command sets or hot-reload scenarios."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-73: CommandRegistry has no unregister method

## Problem

`CommandRegistry` provides `register()` and `clear()` but no `unregister(commandId)` method. The only way to remove a command is `clear()`, which removes all registered commands at once.

This is a gap in the API surface that prevents dynamic command management -- specifically, Hub-specific commands cannot be added when a Hub opens and removed when it closes.

## Impact

- Hub-specific commands cannot be dynamically added/removed as Hubs are opened/closed.
- Hot-reload or plugin-reconfiguration scenarios must clear and re-register all commands.
- Future extensibility for user-defined commands or conditional command sets is blocked.

## Suggested Fix

Add an `unregister(commandId: string)` method alongside the existing `clear()`:

```typescript
unregister(commandId: string): boolean {
    return this.commands.delete(commandId);
}
```

This is a single-method addition with no breaking changes to existing consumers.

## Affected Files

- `src/infrastructure/commands/CommandRegistry.ts`
