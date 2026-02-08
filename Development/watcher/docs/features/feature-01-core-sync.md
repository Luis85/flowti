# Feature 1: Core Synchronization

Covers the three sync directions (source-only, vault-only, bidirectional), subfolder depth, and new directory detection.

> **Test file:** `tests/acceptance/feature1-core-sync.test.ts` — 5 passing, 8 skipped

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-01 | Source-Only Sync (external → vault) | Importing external files into Obsidian | ⏭️ 1/4 (chokidar) |
| UC-02 | Vault-Only Sync (vault → external) | Exporting vault files to external tools | ✅ 2/3 |
| UC-03 | Bidirectional Sync | Editing files from both Obsidian and external editors | ✅ 2/3 |
| UC-04 | Subfolder Watching | Controlling recursive vs top-level watching | ⏭️ 0/2 (chokidar) |
| UC-05 | New Directory Detection | Auto-scanning new source subdirectories | ⏭️ 0/3 (chokidar) |
