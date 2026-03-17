---
name: Storybook Sitemap Integration
status: published
created: 2026-03-16
iteration: "Agent World (#5)"
requirements: []
deliverables: []
---

# Storybook Sitemap Integration

> See your entire CLI as a visual component library — every sitemap page rendered in Storybook as a terminal view.

---

## Value Proposition

Flowti CLI's UI is defined declaratively in `sitemap.json` — 33 pages with actions, groups, and navigation. But until now, there was no way to see the whole UI at a glance without running the CLI and navigating page by page. Storybook Integration bridges that gap: one action imports the entire sitemap into the component library, where every page renders as a terminal-styled view inside Storybook. Designers review page layouts, product owners verify action structures, and developers browse the full UI surface — all without launching the CLI. Because it reuses the existing component pipeline, stories stay in sync with sitemap changes through the standard regeneration flow.

## Key Capabilities

- **Full application visibility** — See every page of your CLI app laid out in Storybook, side by side, without running the application
- **Design showcase** — Present your application's navigation structure, page layouts, and user flows to stakeholders in a familiar browser environment
- **Terminal-faithful rendering** — Pages look like the real CLI: dark terminal window, action menus with shortcut keys, grouped sections with separators
- **Always in sync** — When the sitemap changes, re-import and regenerate to keep the showcase current
- **One action to set up** — Import from Sitemap scaffolds everything; no manual story writing needed

## Usage Examples

### Showcasing the CLI to stakeholders

You're preparing a demo for a product review. Instead of screen-recording the CLI page by page, you import from sitemap and start Storybook. Stakeholders browse every page in their browser — Start Menu, Project Detail, Health, Build, Agents — each rendered as a terminal view. They can see the full navigation structure and give feedback on page layouts without needing the CLI installed.

### Reviewing page design during development

You've just added three new pages to `sitemap.json`. Before committing, you re-run "Import from Sitemap" and start Storybook. The new pages appear alongside existing ones, making it easy to verify consistency — do the action groups make sense? Are the shortcut keys logical? Is the page description clear? You catch a missing action before it reaches the main branch.

---

<!-- Internal Reference — Engineering Only -->

## Technical Notes

- **Architecture**: A pure mapper function (`sitemapToComponents`) converts sitemap `PageObject` entries into instance JSONs consumed by the existing component library import pipeline. Two custom `ComponentTemplateFn` functions generate terminal-styled HTML factories. A `resolveBlueprint()` enhancement (id-first, kind-fallback) enables blueprint selection by ID.
- **Dependencies**: Existing component system (`component-library.ts`, `component-commands.ts`, `component-registry.ts`), existing story template (`componentStoryTemplate` HTML path), existing Storybook lifecycle (install/start/stop/build).
- **Constraints**: HTML/Vite framework only (no Angular/React). Terminal views are static mocks, not live CLI output. Two-step regeneration (re-import then regen-dirty).

## Implementation Status

| Deliverable | Status | Iteration | Notes |
|-------------|--------|-----------|-------|
| `sitemapToComponents()` mapper | complete | #5 | Pure domain function, 14 tests |
| Terminal-view layout template | complete | #5 | `ComponentTemplateFn`, 8 tests |
| Terminal-page component template | complete | #5 | Action rendering with groups, 10 tests |
| Terminal-view CSS template | complete | #5 | Full terminal styling, 11 tests |
| Blueprint definitions (2 JSONs) | complete | #5 | `terminal-view`, `terminal-page` |
| Registry + resolveBlueprint update | complete | #5 | 10 definitions, 9 templates |
| Handler wiring (data source + action) | complete | #5 | `sitemap-ops` + `comp:sitemap-import` |
| Sitemap + config changes | complete | #5 | `onImportSitemap` action, framework→html |

## Spec & Plan References

- **Design spec**: `docs/specs/2026-03-16-storybook-sitemap-integration-design.md`
- **Implementation plan**: `docs/plans/2026-03-16-storybook-sitemap-integration.md`
- **Branch**: `feat/iter-5/storybook-sitemap-integration` (11 commits, 57 new tests)
