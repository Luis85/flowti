---
domain: Folder Watcher
stage: done
plugin: "[[Development/watcher/README|README]]"
type: Feature
---
# Feature 11: Export / Import Mappings

Share folder mapping configurations as JSON so other users can set up their vault with the same sync structure.

> **Test files:** `tests/services/MappingExportService.test.ts` (29 tests) + `tests/settings/MappingExportImport.test.ts` (7 tests) — 36 passing, 0 skipped

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-47 | Export Mappings to JSON | [US-C8](../user-stories/As%20User,%20I%20want%20to%20share%20my%20folder%20mappings%20with%20others%20to%20help%20them%20setup%20their%20vault.md) | ✅ 14/14 |
| UC-48 | Import Mappings from JSON | [US-C8](../user-stories/As%20User,%20I%20want%20to%20share%20my%20folder%20mappings%20with%20others%20to%20help%20them%20setup%20their%20vault.md) | ✅ 22/22 |
