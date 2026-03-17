---
type: DecisionNote
adr: ADR-017
title: Zod Schema Validation for Settings
status: Accepted
date: 2026-01-15
domain: domain/settings
category: Data
drivers:
  - Data Integrity
  - Safety
  - Migration Support
tags:
  - decision
  - architecture
  - validation
---

# ADR-017: Zod Schema Validation for Settings

## Status

**Accepted** — in use since settings service was created.

## Context

Plugin settings are persisted as JSON and loaded on startup. The data can be corrupted, manually edited, or from an older plugin version with a different schema. We need a way to validate settings at load time and fall back to safe defaults.

### Alternatives Considered

1. **Manual validation** — `if (typeof x !== "string") x = default` — verbose, error-prone
2. **JSON Schema** — standard but no TypeScript type inference
3. **io-ts** — powerful but verbose API
4. **Zod (chosen)** — TypeScript-first schema validation with type inference, `.safeParse()`, and default values

## Decision

Settings are validated at load time using `FlowtiSettingsSchema.safeParse()`:

```typescript
const result = FlowtiSettingsSchema.safeParse(rawData);
if (result.success) {
  this.settings = result.data;
} else {
  this.settings = DEFAULT_SETTINGS;
}
```

### Schema Features Used

- **Default values**: `z.boolean().default(false)` — missing fields get defaults
- **Array coercion**: Settings arrays are validated element-by-element
- **Safe parsing**: `safeParse()` never throws — returns success/failure discriminated union
- **Type inference**: `z.infer<typeof FlowtiSettingsSchema>` generates the `FlowtiSettings` type

### Migration Support

`SettingsService.load()` includes migration logic (e.g., `eventDocsBasePath` → `docsRootPath` by stripping `/Events` suffix). Migrations run before Zod validation.

## Consequences

### Positive

- **Crash-proof**: Invalid data never crashes the plugin — always falls back to defaults
- **Type-safe**: Schema and TypeScript type are always in sync via `z.infer`
- **Self-documenting**: Schema defines the canonical shape of settings
- **Migration-friendly**: Old field names are migrated before validation

### Negative

- **Runtime dependency**: Zod is included in the bundle (~13KB minified)
- **Schema duplication risk**: Settings schema and `DEFAULT_SETTINGS` must stay in sync
- **Only settings**: Other persisted state (user, subscriptions, etc.) doesn't use Zod — validated manually

## Related

- [[Backend Architecture]] — SettingsService section
- [[Data Dictionary]] — Settings schema reference
- [[ADR-004 Single JSON Blob Storage]]
