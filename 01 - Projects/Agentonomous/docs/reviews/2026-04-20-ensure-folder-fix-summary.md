---
type: Fix Summary
project: Agentonomous
module: Make + VaultPort
scope: ENOENT on vault.create when parent folder missing
date: 2026-04-20
status: ready-to-commit
---

# Make — ensureFolder fix summary

Post-hoc summary of the bug fix that adds `VaultPort.ensureFolder` and wires it into every Make create path.

## The bug

On a fresh Obsidian vault with no `Make/Types/`, `Make/Bases/`, or user-chosen `instancesFolder`, every Make create operation (`createType`, `createInstance`, `regenerateBaseFile`) failed with a low-level ENOENT thrown out of `vault.create`. The error surfaced as a red `vault-error` banner with no context — and nothing at all in the devtools console, because the service swallowed the failure into a typed error without logging.

Root cause: Obsidian's `Vault.create(path, content)` requires the parent folder to already exist; the Make service assumed it would be auto-created.

## The fix

### 1. New port method

`VaultPort.ensureFolder(path: string): Promise<Result<void, string>>` — idempotent, creates missing segments walking the path top-down, returns `err` only on path conflict (file sitting where a folder should be).

### 2. Adapter implementations

| Adapter | File | Behaviour |
|---|---|---|
| Obsidian | `src/infrastructure/obsidian/obsidian-vault-adapter.ts` | Walks `a/b/c` segment by segment; uses `getAbstractFileByPath` + `TFolder` check; `createFolderSafe` handles the race where another caller creates the folder between check and create. |
| In-memory | `src/infrastructure/vault/in-memory-vault-adapter.ts` | Tracks a `Set<string>` of folder paths; `exists` now returns true for known folders in addition to files. |

### 3. Service wiring

| File | Where ensureFolder was added |
|---|---|
| `make-service-types.ts` | `writeTypeFiles` ensures **both** `typesFolder` and `basesFolder` before the first `vault.create`. |
| `make-service-instances.ts` | `createInstance` ensures the instance's parent folder before creating (only when not overwriting an existing file). |
| `make-service-maintenance.ts` | `regenerateBaseFile` ensures the bases folder before writing — covers the long-lived-vault case where initial base creation was skipped or failed. |

### 4. Console logging on every vault-error path

`createType`, `createInstance`, `deleteInstance`, `deleteInstances`, `deleteType`, `toggleFavorite`, `regenerateBaseFile`, `deleteCorruptFile`, `loadType`, `listTypes`, `updateType`: every `vault-error` return now emits `ports.logger.error('make-service', ...)` with the failing path and cause. Partial-failure paths (base write, base-stamp write) emit `ports.logger.warn` instead. This makes the failure visible in the Obsidian devtools console even when the UI notification is dismissed.

### 5. Test-stub regression lock

`tests/__stubs__/obsidian.ts` — the in-memory Obsidian `Vault` test stub now **reproduces the real bug**: `create` throws `ENOENT` when the parent folder doesn't exist. This means any future regression where the service forgets to call `ensureFolder` before `create` will fail tests, not just skate through silently.

The stub also gained a `createFolder` method and `getAbstractFileByPath` now returns `TFolder` instances for tracked folders.

## Files touched (12)

| File | Kind |
|---|---|
| `src/domain/shared/vault-port.ts` | Port interface |
| `src/infrastructure/obsidian/obsidian-vault-adapter.ts` | Adapter |
| `src/infrastructure/vault/in-memory-vault-adapter.ts` | Adapter |
| `src/modules/make/make-service-types.ts` | Service wiring + logging |
| `src/modules/make/make-service-instances.ts` | Service wiring + logging |
| `src/modules/make/make-service-maintenance.ts` | Service wiring + logging |
| `src/modules/make/update-type-ops.ts` | Logging |
| `tests/__fakes__/fake-ports.ts` | Fake port |
| `tests/__stubs__/obsidian.ts` | Stub — reproduces ENOENT regression |
| `tests/infrastructure/obsidian/obsidian-vault-adapter.test.ts` | 6 new tests |
| `tests/infrastructure/vault/in-memory-vault-adapter.test.ts` | 4 new tests |
| `tests/modules/make/make-service.test.ts` | 2 new tests |

## New test coverage

- **Adapter**: round-trip after `ensureFolder`; idempotency; nested segment walk; root no-op; path-conflict error when a file blocks the segment.
- **In-memory**: folder tracking + `exists`; idempotency; path-conflict; root no-op.
- **Service**: `ensureFolder` is called for **both** `typesFolder` and `basesFolder`, and the `ensure*` calls precede the first `create*` call in invocation order (regression lock on call ordering); `logger.error` fires with the failing path + cause string when a `createType` write fails.

## Out of scope (noted, not fixed)

- `update-type-ops.ts` `moveAllInstances` / `retryFailedMovesImpl` call `vault.rename` into a target folder that might not exist. This is a **latent twin** of the same bug surface — observable when a user renames `instancesFolder` to a path that hasn't been created yet. Not part of the reported ENOENT on create; deferred.
- Two pre-existing issues surfaced during verification (confirmed on clean HEAD): storybook unhandled rejections in `MakeHome.stories.ts` / `MakeTypes.stories.ts` (`types.value` / `kpis.value` undefined under `createTestingPinia`) and one flaky test (`event-inspector-view.test.ts > renders fallback error text when mounting fails` — passes in isolation). Neither is in this fix's scope.

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors, 42 pre-existing warnings.
- Affected test files: 114/114 pass.
- Full suite: 1207/1208 (flake above is pre-existing and unrelated).
