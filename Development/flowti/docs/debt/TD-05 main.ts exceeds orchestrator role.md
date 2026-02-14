---
severity: critical
category: architecture
layer: infrastructure
status: resolved
effort: large
resolved: 2026-02-14
description: main.ts has grown to 956 lines and contains view registrations, command definitions, context menu wiring, and Data Exchange callbacks that belong in dedicated registries or services.
---
# TD-05: main.ts exceeds orchestrator role

## Problem

Per the project's own `AGENTS.md`: "Keep main.ts minimal — lifecycle orchestration only, no business logic."

At 956 lines, `main.ts` now contains:

- View registration for CSV, Export, and Data Exchange Hub views (should be in `views/registry.ts`)
- Command definitions for import/export commands (should be in `commands/registry.ts`)
- Context menu wiring for file-menu events (should be a dedicated service or registry)
- Data Exchange service callback injection (`setListFiles`, `setWriteExternalFile`, `setReadExternalFile`)
- Pending state management (`pendingExportConfig`, `pendingImportAutoStart`, `pendingSavedImportConfig`, `pendingSavedExportConfig`)
- Notice throttling logic
- 11 private instance properties for service references

## Impact

- Violates the project's own conventions
- Hard to test (main.ts is not unit-tested)
- Encourages further accumulation of wiring code
- Tight coupling between plugin class and domain services

## Suggested Remediation

1. Move CSV, Export, DataExchangeHub view registrations to `views/registry.ts`
2. Move import/export commands to `commands/registry.ts`
3. Extract context menu registration into a `ContextMenuService` or `FileMenuRegistry`
4. Move Data Exchange callback injection into `DataExchangeService.initialize()` with an adapter pattern
5. Move notice throttling into a `NoticeService` utility

## Affected Files

- `src/main.ts`
- `src/infrastructure/views/registry.ts`
- `src/infrastructure/commands/registry.ts`

## Resolution (2026-02-14)

Phase 7 extracted `dataExchangeSetup.ts` (368 LOC) from main.ts, moving all Data Exchange view registrations, commands, file-menu items, and callback wiring into a dedicated setup module. `main.ts` is now 482 LOC -- within acceptable range for a plugin orchestrator that manages 11 service loads and the bootstrap sequence.
