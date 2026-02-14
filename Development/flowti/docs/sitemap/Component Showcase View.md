---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - developer
  - view
description: Design system reference showing all available CSS components
type: View
viewType: flowti-component-showcase
extends: ItemView
source: "[[Development/flowti/src/ui/ComponentShowcaseView.ts|ComponentShowcaseView.ts]]"
feature: "[[Documentation]]"
---

# Component Showcase View

## Description

The Component Showcase View is a developer-facing reference that renders all available CSS components and utilities from the Flowti design system. It displays live examples of buttons, inputs, cards, badges, alerts, lists, typography styles, flexbox layouts, spacing utilities, and animations.

This view is not intended for end users. It serves as a living style guide for plugin development, ensuring consistent UI patterns across all views and modals.

## Use Cases

### Verify design system consistency
Open the showcase to visually verify that all component variants (primary, secondary, ghost buttons; card styles; badge colors; alert types) render correctly under the current Obsidian theme.

### Reference available CSS classes
Use the showcase as a quick reference for the `ft-*` CSS utility classes available in the design system. Each section demonstrates the class names needed to achieve specific layouts and styles.

### Test theme compatibility
Switch between Obsidian's light and dark themes while the showcase is open to verify that all components adapt correctly. This catches contrast issues and missing CSS variable bindings early.

### Onboard new contributors
Point new contributors to the showcase as a visual guide to the design system. The live examples are more effective than static documentation for understanding available components.
