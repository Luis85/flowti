---
type: TechDebt
severity: medium
category: architecture
layer: ui
status: open
created: 2026-02-15
effort: medium
description: "Components are directly imported by orchestrators. Need manifest-driven component registry for validation and discoverability."
source: "[[Hubs PRD]]"
feature: "[[Hubs PRD]]"
tags:
  - hubs
  - foundation
---
# TD-51: Component registry and manifest

## Problem

UI components (CatalogDashboard, ReportsTab, EventsTab, etc.) are directly imported by their orchestrator views. There is no registry, no manifest, and no validation that a component exists before it's referenced.

This means:
- No compile-time or startup-time validation of component references in tab definitions
- No way to discover available components programmatically
- Component metadata (what events it emits, what context it needs) is implicit in code
- The Component Showcase view (TD-38) cannot auto-discover components

### Current pattern

```typescript
// EventCatalogView — directly imports all components
import { CatalogDashboard } from "./catalog/CatalogDashboard";
import { CatalogDomainsTab } from "./catalog/DomainsTab";
// ...13 more imports
```

## Target State

A JSON manifest + TypeScript registry that:

1. **`component-manifest.json`** declares all components with metadata: kind, description, props contract, emitted events, accepted context, tags
2. **`ComponentRegistry`** provides `has(name)`, `get(name)`, `getNameSet()` for validation
3. **Tab definition validator** (TD-52) uses the registry to verify component references

### Target pattern

```typescript
import { hasComponent, getComponentNameSet } from "./components/component-registry";

// During tab config validation
if (!hasComponent(regionOverride.component)) {
    issues.push({ level: "error", message: `Unknown component: ${regionOverride.component}` });
}
```

## Scope

### New files

- `src/ui/components/component-manifest.json` — JSON manifest (see [[Hubs]] architecture reference for schema)
- `src/ui/components/component-registry.ts` — `getComponentNameSet()`, `hasComponent()`, `getComponentMeta()`
- `src/ui/components/index.ts` — barrel export

### Modified files

- None initially (registry is additive). TD-52 (tab definitions) will wire validation.

## Dependencies

- None (can be built independently)

## Priority

**High** — Required for tab definition validation (TD-52). Can be built in parallel with TD-49.

## Acceptance Criteria

- [ ] `component-manifest.json` lists all current UI components with metadata
- [ ] `hasComponent(name)` returns true for registered components, false otherwise
- [ ] `getComponentNameSet()` returns the full set for bulk validation
- [ ] `getComponentMeta(name)` returns component metadata or null
- [ ] Unit tests for registry lookups
