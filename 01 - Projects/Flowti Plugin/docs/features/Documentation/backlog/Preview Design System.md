---
type: UseCase
domain: Flowti
stage: done
description: "Open the Component Showcase to visually verify all CSS components render correctly under the current Obsidian theme"
view: "[[Component Showcase View]]"
feature: "[[Documentation Hub PRD]]"
testplanRef: "UC-89, UC-90, UC-91, UC-92"
tags:
  - use-case
  - showcase
---

# Preview Design System

## Summary

Open the Component Showcase view to visually inspect and verify that all Flowti CSS components render correctly under the current Obsidian theme. This is the primary tool for ensuring design consistency across themes and for catching visual regressions after CSS changes.

## Preconditions

- The Flowti plugin is installed and enabled in Obsidian.
- At least one Obsidian theme is active (default or custom).
- The user intends to verify visual rendering of UI components (e.g., after a theme change, plugin update, or CSS modification).

## Steps

1. Open the command palette and run **Flowti: Open Component Showcase** (or click the Component Showcase icon in the ribbon if available).
2. The Component Showcase View opens, displaying a categorized gallery of all Flowti CSS components.
3. Scroll through the **Buttons** section and verify that primary, secondary, destructive, and icon buttons render with correct colors, borders, hover states, and spacing.
4. Review the **Inputs and Controls** section, checking that text inputs, dropdowns, toggles, and search fields display correctly with proper focus states and placeholder text.
5. Inspect the **Cards, Badges, and Alerts** section to confirm that card containers have correct shadows and borders, badges show proper background colors and text contrast, and alert variants (info, success, warning, error) are visually distinct.
6. Examine the **Lists and Typography** section, verifying that list items, headings, body text, and monospace code blocks align with the theme's font settings and spacing conventions.
7. Review the **Layouts and Spacing** section to confirm that grid layouts, flex containers, master-detail splits, and spacing utilities produce the expected visual structure.
8. Check the **Animations** section by interacting with animated components (e.g., loading spinners, transition effects, fade-ins) to verify smooth rendering without jank or visual artifacts.

## Outcome

The user has visually confirmed that all Flowti CSS components render correctly under the current Obsidian theme, with no broken layouts, missing styles, incorrect colors, or animation issues.

## Variations

- **Theme switching**: After verifying one theme, switch to a different Obsidian theme (e.g., from light to dark mode, or to a community theme) and repeat the inspection to ensure cross-theme compatibility.
- **CSS regression check**: After modifying plugin CSS files, open the Showcase to quickly identify any components affected by the change.
- **Responsive testing**: Resize the Obsidian window or move the Showcase to a narrow sidebar pane to verify that components adapt to different viewport widths.
- **Selective review**: If only a specific component category was modified, scroll directly to that section rather than reviewing the entire showcase.

## Related

- View: [[Component Showcase View]]
- Feature: [[Documentation Hub PRD]]
- Test: UC-89, UC-90, UC-91, UC-92 in [[Testplan and Teststrategy]]
