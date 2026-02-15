---
status: open
severity: medium
category: architecture
layer: domain
created: 2026-02-15
effort: medium
description: pathResolver.ts hardcodes subfolder names ("Flows", "Systems", etc.) and installer/folders.ts hardcodes full paths, both ignoring the settings.entityPaths configuration which is effectively dead code.
source: "[[Technical Review 2026-02-15]]"
---
# TD-40: Hardcoded paths ignore settings.entityPaths

## Problem

The `DEFAULT_SETTINGS` defines an `entityPaths` configuration:

```typescript
entityPaths: {
  flows: { subfolder: "Flows", overridePath: "" },
  systems: { subfolder: "Systems", overridePath: "" },
  actors: { subfolder: "Actors", overridePath: "" },
  products: { subfolder: "Products", overridePath: "" },
}
```

However, **no code reads this configuration**. Two subsystems hardcode paths instead:

### 1. pathResolver.ts — hardcoded subfolder names

All path functions in `src/domain/docs/pathResolver.ts` hardcode subfolder names:

```typescript
export function getFlowDocPath(basePath: string, flow: string): string {
  return `${normalize(basePath)}/Flows/${flow}.md`;  // "Flows" hardcoded
}
```

Should be:

```typescript
export function getFlowDocPath(basePath: string, subfolder: string, flow: string): string {
  return `${normalize(basePath)}/${subfolder}/${flow}.md`;
}
```

### 2. installer/folders.ts — hardcoded full paths

```typescript
"03 - Resources/Documentation/Reference/Domains",
"03 - Resources/Documentation/Reference/Services",
"03 - Resources/Documentation/Reference/Events",
// ... etc
```

Ignores `settings.docsRootPath` completely. If user changes `docsRootPath`, the installer scaffolds in the wrong location.

### 3. EventCatalogView.ts — hardcoded default

```typescript
private docsRootPath = "03 - Resources/Documentation/Reference";
```

This is a fallback default before `settings.loaded` fires. Acceptable as a default but should be sourced from `DEFAULT_SETTINGS.docsRootPath`.

## Impact

- `settings.entityPaths` is dead code — changing it has no effect
- Users cannot customize doc folder structure
- Installer scaffolds at hardcoded paths regardless of settings

## Suggested Fix

1. Refactor `pathResolver.ts` to accept `EntityPathConfig` or accept subfolder as parameter
2. Refactor `installer/folders.ts` to accept `docsRootPath` from settings context
3. Remove `entityPaths` from settings if customization is not planned, OR wire it through

## Affected Files

- `src/domain/docs/pathResolver.ts`
- `src/domain/installer/folders.ts`
- `src/domain/settings/settings.ts` (entityPaths definition)
- `src/ui/EventCatalogView.ts` (hardcoded default)
