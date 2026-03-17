---
type: TechDebt
severity: high
category: compliance
layer: ui
status: resolved
resolved_in: "[[Cycle 48 - Stabilize and Strategic Spike]]"
resolved_date: 2026-02-27
created: 2026-02-27
effort: high
description: "1,724 inline style assignments across 90+ UI files violate Obsidian marketplace ESLint rule obsidianmd/no-static-styles-assignment. All styles extracted to CSS classes."
domain: ui
parent: "[[Release Preparation PRD]]"
---

# TD-129: Inline style assignments violate Obsidian marketplace policy

## Problem

After enabling `eslint-plugin-obsidianmd` (Cycle 48, Inc 4), the `obsidianmd/no-static-styles-assignment` rule flagged **1,724 inline style assignments** across 90+ UI source files. Obsidian marketplace policy requires CSS classes instead of inline `el.style.x = "value"` assignments for static styles.

## Impact

- Release blocker: marketplace review would fail with 1,724 violations
- Inconsistent styling approach: mix of CSS classes and inline styles
- No CSS-level theming for inline styles (cannot be overridden by users)

## Resolution (Cycle 48)

1. **Bulk extraction**: 10 parallel agents extracted all 1,724 inline styles into CSS classes with `ft-` prefix
2. **Dead class removal**: 52 unused classes removed
3. **Utility normalization**: 40+ duplicate utility names consolidated to 17 canonical classes
4. **CSS consolidation**: styles.css reduced from 7,356 to 5,730 lines (22% reduction)
5. **Layered architecture**: 12 source CSS files in `css/` directory with build pipeline concat

Result: 0 ESLint errors, 0 warnings. All 5,315 tests passing.

## Affected Files

- 90+ files in `src/ui/` (inline styles replaced with CSS classes)
- `css/` directory (12 new source files)
- `esbuild.config.mjs` (added `concatCSS()` + CSS watcher)
- `styles.css` (now auto-generated from `css/` sources)

## Related

- [[TD-118 session helpers.ts exceeds 600 LOC with mixed concerns]] — resolved same cycle
- [[PBI-RP-002 Obsidian ESLint Compliance]] — parent release blocker
