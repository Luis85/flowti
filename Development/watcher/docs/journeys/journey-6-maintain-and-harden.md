# Journey 6: Maintain and Harden the Plugin

> **Persona:** [The Maintainer (Luis)](../personas/maintainer.md) — the solo developer who
> builds, tests, and ships the Folder Watcher plugin.

## Steps

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | Luis runs `npm run build` — vitest, typedoc, tsc, eslint, esbuild all execute in sequence | (build pipeline) |
| 2 | A test fails in `VaultWatcher.test.ts` — Luis reads the failure output and identifies a regression | UC-28 Debounce, UC-29 Backpressure |
| 3 | Luis writes a minimal reproduction test that isolates the bug | UC-27 Loop Prevention |
| 4 | Luis fixes the bug and sees all 460+ tests go green | (test suite) |
| 5 | A user reports that syncing a 200 MB file freezes the plugin — Luis verifies the file size limit catches it | UC-30 File Size Limit |
| 6 | Luis adds a targeted test: file > MAX_FILE_SIZE_BYTES → action: "skipped", reason: "file_too_large" | UC-30 File Size Limit |
| 7 | Luis discovers a silent `catch {}` in FileSyncService — replaces it with `LogService.debug` | (error visibility) |
| 8 | Luis creates a mapping where target folders overlap — overlap validation catches the misconfiguration | UC-35 Overlapping Mapping Validation |
| 9 | Luis tests a file with an accented name (`naïve.md`) — Unicode NFC normalization prevents duplicates | UC-33 Unicode Normalization |
| 10 | Luis tests a deeply nested path exceeding 260 chars on Windows — path length validation rejects it | UC-32 Windows Path Length |
| 11 | Luis simulates an EBUSY error — `withRetry` retries with exponential backoff and succeeds | UC-26 Retry |
| 12 | Luis verifies that non-retryable errors (ENOENT, EACCES) are thrown immediately without retry | UC-26 Retry |
| 13 | Luis runs a move detection test — file delete + add with matching size and extension is detected as a move | UC-13 Move Detection |
| 14 | Luis tests SyncState persistence — corrupted JSON is handled gracefully, starting fresh | UC-43 Persistence |
| 15 | Luis reviews the test plan index — coverage percentages and skip reasons show where gaps remain | (test plan) |
| 16 | Luis tags a release, runs the full build pipeline, and confirms the artifact is clean | (release) |

## Happy Path Test

Run full build pipeline → identify regression via test failure → write reproduction test → fix and verify green → add file size limit test → fix silent error swallowing → validate overlapping mappings → verify Unicode normalization → verify Windows path length → test retry logic (retryable vs non-retryable) → test move detection accuracy → verify corrupt state recovery → review test plan gaps → ship release.
