---
type: TechDebt
severity: medium
category: architecture
layer: ui
status: open
created: 2026-02-15
effort: large
description: "Tabs are imperative TypeScript classes with hard-coded render methods. Need declarative JSON tab configs validated against layout and component manifests."
source: "[[Hubs PRD]]"
feature: "[[Hubs PRD]]"
tags:
  - hubs
  - foundation
---
# TD-52: Declarative tab definition system

## Problem

Each tab in EventCatalogView and DataExchangeHubView is an imperative TypeScript class that:
- Manually creates DOM elements for its layout
- Directly imports and instantiates components
- Hard-codes event bus subscriptions
- Has no schema validation

This means:
- Adding a tab requires writing a new class (~200-500 LOC)
- Tab configurations cannot be validated before runtime
- Layout and component references are implicit
- No consistency enforcement across hubs

### Current tab definition (implicit)

```typescript
// Each tab class encodes its structure in code
class DomainsTab {
    constructor(masterEl, detailEl, deps) { /* ... */ }
    renderMaster() { /* manually creates DOM, subscribes to events */ }
    renderDetail(entry) { /* manually creates DOM */ }
}
```

## Target State

Declarative JSON tab definitions that:

1. **Specify layout** by reference (`layout_ref: "split_dock"`)
2. **Bind data sources** with adapter method references and refresh policies
3. **Override regions** with specific components
4. **Declare event bus subscriptions** for refresh triggers
5. **Validate** against layout manifest (TD-49) and component manifest (TD-51) at startup

### Target pattern

```json
{
    "id": "domains",
    "label": "Domains",
    "icon": "boxes",
    "layout_ref": "split_dock",
    "bindings": {
        "data_sources": {
            "domains": {
                "adapter_method": "getDomains",
                "refresh_policy": { "strategy": "event", "events": ["doc.created", "doc.deleted"] }
            }
        }
    },
    "regions": {
        "primary": { "component": "DomainEntityList" },
        "inspector": { "component": "InspectorPanel" }
    }
}
```

### Validation

The `validateTabDefinitionsAgainstManifest()` function (defined in [[Hubs]] architecture reference) checks:
- Layout reference exists in layout manifest
- All region overrides reference valid region names for the specified layout
- All component references exist in component manifest
- Required regions have components assigned

## Scope

### New files

- `src/ui/tabs/types.ts` — `TabDefinition`, `TabBinding`, `RegionOverride` interfaces
- `src/ui/tabs/tab-schema.ts` — JSON schema for tab definitions
- `src/ui/tabs/validateTabConfig.ts` — validator function
- `src/ui/tabs/TabRenderer.ts` — renders a tab from its definition (mounts layout, populates regions)
- `src/ui/tabs/index.ts` — barrel export

### Modified files (Phase 2)

- Hub adapters will return `TabDefinition[]` from `getTabDefinitions()`
- Shell (TD-50) will pass definitions to TabRenderer

## Dependencies

- **TD-49** (Layout abstraction) — for layout_ref resolution
- **TD-51** (Component registry) — for component validation

## Priority

**High** — Enables declarative hub configuration. Required for clean hub adapters.

## Acceptance Criteria

- [ ] `TabDefinition` interface covers layout_ref, bindings, regions, event_bus
- [ ] Validator checks layout_ref against layout manifest
- [ ] Validator checks component references against component manifest
- [ ] Validator reports errors (blocking) and warnings (advisory) separately
- [ ] `TabRenderer` mounts a layout and populates regions from tab definition
- [ ] Unit tests for validator covering: valid config passes, bad layout fails, bad component fails, missing required region warns
