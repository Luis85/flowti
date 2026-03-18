# Markdown-to-Sitemap Import — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Author:** Claude (brainstorming session)

## Problem

The existing storybook scaffold pipeline reads a hand-crafted `sitemap.json` to generate framework-specific story files and component stubs. There is no way to generate a sitemap from a folder of markdown component definitions — a common pattern in design systems where components are documented as individual markdown files with YAML frontmatter.

## Goal

Add a markdown-to-sitemap converter that slots in before the existing `scaffoldStorybookFromSitemap()` function. Markdown files in a user-specified folder are parsed, validated, and converted into a standard `UnifiedSitemap` (v2) that the existing scaffold pipeline already consumes. Zero changes to existing scaffold or template code.

## Full Chain

```
Markdown files → [infrastructure: scan & parse YAML] → [domain: validate & generate] → sitemap.json → existing scaffold pipeline
```

```bash
flowti storybook:import --output=sitemap.json
flowti storybook:scaffold --sitemap=sitemap.json --framework=react
```

The `storybook:import` command uses `requires: "project"` — the project is resolved by the command engine, not passed as a flag.

## Config Schema

New `markdownSource` block inside the existing `components` section of `flowti.config.json`:

```json
"components": {
  "storybook": true,
  "storybookDir": "components",
  "framework": "html",
  "markdownSource": {
    "path": "../design-system/components",
    "strategy": "category",
    "requiredFields": ["name", "category", "description", "props", "slots", "variants", "status"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Relative path to folder containing markdown component files |
| `strategy` | `"category" \| "flat" \| "hierarchical"` | How components map to sitemap page structure |
| `requiredFields` | `string[]` | Frontmatter fields that must be present for a file to be importable |

## Markdown Component File Schema

Each `.md` file in the source folder uses Obsidian-compatible YAML frontmatter (primitives and flat string lists only — no nested objects):

```markdown
---
name: Button
category: atoms
description: Primary interactive element for user actions
status: ready
props:
  - variant
  - disabled
  - size
slots:
  - default
  - icon
variants:
  - primary
  - outlined
  - ghost
---

# Button

Detailed documentation, usage notes, examples go here.
The markdown body is informational — frontmatter drives the generation.
```

### Field Definitions

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | `string` | Non-empty, component identifier |
| `category` | `string` | Non-empty, grouping key (e.g., `atoms`, `forms`, `navigation`) |
| `description` | `string` | Non-empty, what the component does |
| `status` | `string` | One of: `draft`, `ready`, `deprecated` |
| `props` | `string[]` | Flat list of property names |
| `slots` | `string[]` | Flat list of slot names |
| `variants` | `string[]` | Flat list of variant names |

### Validation Rules

- All fields listed in `requiredFields` must be present
- `name`, `category`, `description` must be non-empty strings
- `status` must be one of: `draft`, `ready`, `deprecated`
- `props`, `slots`, `variants` must be arrays (can be empty `[]`)
- Files failing validation are **skipped with a warning**, not a hard error
- Only `.md` files are scanned (other file types ignored)

## Sitemap Generation Strategies

All strategies produce a standard `UnifiedSitemap` (version 2, `pages: Record<string, PageObject>`).

### Category (default)

Each unique `category` becomes a parent page. Components become child pages under their category.

```
atoms/          → page "atoms" (kind: "page")
  Button        → page "button" (kind: "component", parent: "atoms")
  Badge         → page "badge" (kind: "component", parent: "atoms")
navigation/     → page "navigation" (kind: "page")
  Navbar        → page "navbar" (kind: "component", parent: "navigation")
```

### Flat

Every component is a top-level page. Categories are metadata only, not structural.

```
button          → page "button" (kind: "component")
navbar          → page "navbar" (kind: "component")
text-input      → page "text-input" (kind: "component")
```

### Hierarchical

Categories with `/` separators create nested parent-child page relationships.

```
forms/          → page "forms" (kind: "page")
forms/inputs/   → page "forms-inputs" (kind: "page", parent: "forms")
  TextInput     → page "text-input" (kind: "component", parent: "forms-inputs")
forms/selectors → page "forms-selectors" (kind: "page", parent: "forms")
  Select        → page "select" (kind: "component", parent: "forms-selectors")
```

Components with categories that don't contain `/` behave like the category strategy.

### Frontmatter-to-PageObject Mapping

| Frontmatter | PageObject field | Notes |
|-------------|-----------------|-------|
| `name` | `label` | |
| `description` | `description` | |
| `status` | `status` | `"ready"` maps to `"active"` (PageObject uses `"draft" \| "active" \| "deprecated"`) |
| `category` | Drives page structure | Strategy-dependent; not stored directly on PageObject |
| `props` | `properties` | Each string → `PageProperty` with `key: propName, type: "string"` (default type) |
| `slots` | `children` | Each string → `PageChild` with `ref: kebab(componentName), slot: slotName` |
| `variants` | `variants` | Each string → `PageVariant` with `name: variantName, props: {}` (empty props) |

All generated pages include `actions: []` (required by PageObject).
Component pages use `kind: "component"`. Category group pages use `kind: "page"`.

### Page ID Generation

Page IDs are generated as kebab-case to avoid collisions:

- **Category strategy:** component ID = `{category}-{name}` (e.g., `atoms-button`), category page ID = `{category}` (e.g., `atoms`)
- **Flat strategy:** component ID = `{category}-{name}` (e.g., `atoms-button`) — category prefix prevents collisions between same-named components in different categories
- **Hierarchical strategy:** component ID = `{full-category-path}-{name}` (e.g., `forms-inputs-text-input`), intermediate page IDs follow the category path (e.g., `forms`, `forms-inputs`)

## Layer Responsibilities

### Infrastructure Layer

YAML frontmatter parsing and file I/O live in infrastructure (not domain) to respect the architecture boundary. The existing `parseFrontmatterContent()` from `src/infrastructure/frontmatter.ts` handles the YAML extraction.

**File scanning and parsing** happens in the controller handler (which has access to `deps`):
1. Read `.md` files from the configured `path` via `deps.disk`
2. Parse YAML frontmatter via `parseFrontmatterContent()` (infrastructure)
3. Pass already-parsed records to domain functions for validation and sitemap generation
4. Write output sitemap via `deps.disk`

### Domain Layer

**File:** `src/domain/make/markdown-sitemap-import.ts`

Two pure functions — no I/O, no infrastructure imports:

### `validateComponents(files: Record<string, Record<string, unknown>>, requiredFields: string[]): ValidationResult`

- Takes a record of filename → parsed frontmatter (already extracted by infrastructure)
- Validates each entry against required fields and type constraints
- Returns `{ valid: ComponentMarkdown[], warnings: ImportWarning[] }`
- Warnings include filename and reason for skip

### `generateSitemapFromMarkdown(components: ComponentMarkdown[], strategy: Strategy): UnifiedSitemap`

- Converts validated components into a v2 `UnifiedSitemap`
- Applies the chosen strategy for page structure
- Maps frontmatter fields to PageObject fields (see mapping table above)
- Returns a sitemap ready for `scaffoldStorybookFromSitemap()`

## New Types

**File:** `src/domain/make/markdown-sitemap-types.ts`

```typescript
type Strategy = "category" | "flat" | "hierarchical";

interface ComponentMarkdown {
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly status: "draft" | "ready" | "deprecated";
  readonly props: readonly string[];
  readonly slots: readonly string[];
  readonly variants: readonly string[];
}

interface ImportWarning {
  readonly file: string;
  readonly reason: string;
}

interface ValidationResult {
  readonly valid: readonly ComponentMarkdown[];
  readonly warnings: readonly ImportWarning[];
}

interface ImportResult {
  readonly sitemap: UnifiedSitemap;
  readonly componentCount: number;
  readonly skippedCount: number;
  readonly warnings: readonly ImportWarning[];
}

interface MarkdownSourceConfig {
  readonly path: string;
  readonly strategy: Strategy;
  readonly requiredFields: readonly string[];
}

// Deps subset for the import command handler (controller level)
type ImportDeps = Pick<CliDeps, "disk" | "paths">;
```

## New CLI Command

**Command:** `storybook:import`

```bash
flowti storybook:import --output=sitemap.json
```

Uses `requires: "project"` — the project is resolved by the command engine automatically.

**Flags:**

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--output` | `string` | no | `{storybookDir}/sitemap.json` | Output path for generated sitemap |

**Behavior:**

1. Reads `markdownSource` config from project's `flowti.config.json`
2. Resolves `path` relative to project root
3. Scans folder for `.md` files via `deps.disk`
4. Parses YAML frontmatter via `parseFrontmatterContent()` (infrastructure)
5. Passes parsed records to `validateComponents()` (domain)
6. Passes valid components to `generateSitemapFromMarkdown()` (domain)
7. Writes sitemap JSON to `--output` path via `deps.disk` (controller handles I/O)
8. Returns `ImportResult` model to renderer
9. Renderer reports: `X components imported, Y skipped` (with reasons for each skip)

**Controller:** Added to `src/controller/storybook.controller.ts` as a new `storybook:import` descriptor using `adaptDescriptor` with `requires: "project"`.

## Test Plan

**File:** `tests/domain/make/markdown-sitemap-import.test.ts`

### parseComponentMarkdown

- Valid frontmatter with all 7 fields → returns ComponentMarkdown
- Missing required field → returns null
- Invalid status value → returns null
- Empty props/slots/variants arrays → valid
- No frontmatter delimiter → returns null
- Malformed YAML → returns null

### validateComponents

- All valid records → all in `valid`, no warnings
- Mix of valid and invalid → valid ones pass, warnings for invalid
- Empty record → empty valid, no warnings
- Custom requiredFields subset → validates only those fields
- `status: "ready"` accepted (maps to `"active"` during generation)

### generateSitemapFromMarkdown — Category Strategy

- Groups components by category into parent pages
- Parent pages have `kind: "page"`, components have `kind: "component"`
- Props → `properties` (`PageProperty` with `key`, `type: "string"`), slots → `children` (`PageChild` with `ref`, `slot`), variants → `variants` (`PageVariant` with `name`, `props: {}`)

### generateSitemapFromMarkdown — Flat Strategy

- Every component is top-level, no parent pages
- Category preserved as metadata only

### generateSitemapFromMarkdown — Hierarchical Strategy

- Nested categories (`forms/inputs`) create intermediate parent pages
- Non-nested categories behave like category strategy
- Parent chain is correct (component → subcategory → category)

## Files Changed

| File | Change |
|------|--------|
| `src/domain/make/markdown-sitemap-types.ts` | **New** — Type definitions (`ComponentMarkdown`, `Strategy`, `ValidationResult`, `ImportResult`, `ImportDeps`) |
| `src/domain/make/markdown-sitemap-import.ts` | **New** — Two pure domain functions (`validateComponents`, `generateSitemapFromMarkdown`) |
| `src/controller/storybook.controller.ts` | **Modified** — Add `storybook:import` command descriptor (handles I/O: scan, parse, write) |
| `src/infrastructure/types-config.ts` | **Modified** — Add `markdownSource?: MarkdownSourceConfig` to `ComponentsConfig` interface |
| `configs/flowti.config.json` | **Modified** — Add `markdownSource` to `components` section |
| `tests/domain/make/markdown-sitemap-import.test.ts` | **New** — Unit tests for domain functions |

## Out of Scope

- Enriching templates with props/slots metadata (future enhancement)
- File watching / auto-regeneration on markdown changes
- Plugin-side UI for triggering import (uses CLI command via VaultProjectService)
- Parsing markdown body content (informational only)
- The `@storybook/html-vite` missing package error (separate issue)
