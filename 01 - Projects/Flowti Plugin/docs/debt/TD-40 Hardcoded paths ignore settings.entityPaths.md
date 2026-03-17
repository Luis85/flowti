---
type: TechDebt
status: resolved
severity: low
category: architecture
layer: domain
created: 2026-02-15
updated: 2026-02-15
effort: small
description: "entityPaths IS wired through EventCatalogView → resolveEntityPath(). Legacy path functions in pathResolver.ts are dead code (13/14 unused). Installer folders.ts scaffolds a subset of hardcoded paths."
source: "[[Technical Review 2026-02-15]]"
---
# TD-40: Hardcoded paths ignore settings.entityPaths

## Original Concern

The initial review stated `settings.entityPaths` was "dead code" that nothing reads.

## Resolution: Partially False Positive

Investigation confirmed **entityPaths IS properly wired** through the main code path:

```
EventCatalogView.ts
  ├── settings.loaded → this.entityPaths = event.payload.settings.entityPaths
  ├── settings.changed → this.entityPaths = event.payload.settings.entityPaths
  └── getEntityFolder(entity) → resolveEntityPath(docsRootPath, entityPaths[entity])
        └── used by all 8 entity tabs via deps.getEntityFolder()
```

All entity folder resolution goes through `resolveEntityPath()` which respects both `subfolder` and `overridePath` from `EntityPathConfig`. Changing `entityPaths` in settings DOES affect the entity tab folder resolution.

## Remaining Issues (Low Severity)

### 1. Legacy path functions — ~~dead code~~ DELETED (2026-02-15)

All 14 legacy path functions were deleted from `pathResolver.ts`, along with their re-exports from `index.ts` and `eventDocTemplate.ts`. The `configDocContent.ts` duplicate `getEventDocPath` was also removed, replaced with `getEventDocPathResolved`. Legacy test blocks (~65 tests) removed from `pathResolver.test.ts` and `eventDocTemplate.test.ts`.

### 2. Installer folders — hardcoded subset

`installer/folders.ts` hardcodes `"03 - Resources/Documentation/Reference/Entities"`, `"Events"`, `"Actors"` etc. It doesn't create all 8 entity folders and doesn't respect `docsRootPath`.

**Impact**: Low — the installer runs once on first install. Entity folders are auto-created by DocService when the first doc is created. The installer is a convenience, not a necessity.

### 3. EventCatalogView default — acceptable

```typescript
private docsRootPath = "03 - Resources/Documentation/Reference";
```

This is a fallback before `settings.loaded` fires. It matches `DEFAULT_SETTINGS.docsRootPath`. Acceptable.

## Affected Files

- ~~`src/domain/docs/pathResolver.ts`~~ (legacy functions deleted)
- `src/domain/installer/folders.ts` (hardcoded subset — low impact, acceptable)
- ~~`src/domain/dataExchange/configDocContent.ts`~~ (duplicate `getEventDocPath` replaced with resolved variant)
