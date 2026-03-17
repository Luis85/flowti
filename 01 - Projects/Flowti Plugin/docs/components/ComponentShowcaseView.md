---
type: Component
domain: Flowti
stage: done
description: "Development-only view showcasing all CSS components and design system utilities"
source: "[[Development/flowti/src/ui/ComponentShowcaseView.ts|ComponentShowcaseView.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - view
  - component
---

# ComponentShowcaseView

## Description

ComponentShowcaseView is a development and testing utility view that showcases all available CSS components and design system utilities in the Flowti plugin. It extends Obsidian's `ItemView` and renders a single scrollable page with live examples of every UI primitive: buttons, inputs, cards, badges, alerts, lists, typography, and layout utilities.

The view is registered under the type `flowti-component-showcase` and displays as "Flowti Components" with the `palette` icon. It has no external dependencies, no event subscriptions, and no state management -- it is purely a static reference view for designers and developers.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `WorkspaceLeaf` | Obsidian class | Standard ItemView leaf parameter |

This view has no injected services, event bus, or state providers. It is entirely self-contained.

## State

This view manages no state. It renders static content on open and has no dynamic behavior beyond the fade-in animation demo button.

## Renders

The view renders 8 sections, each demonstrating a component category:

- **Header**: Title "Flowti Component Showcase" with description and divider
- **Buttons**: Primary, Secondary, and Ghost button variants; icon buttons; disabled state
- **Inputs**: Text input with placeholder, pre-filled input, readonly input
- **Cards**: Simple card with text, card with action button
- **Badges**: Accent and muted badge variants
- **Alerts**: Info, success, warning, and error alert styles
- **Lists**: List items with icons including active state
- **Typography**: Heading sizes (lg/md/sm), text colors (normal/muted/faint), text sizes (sm/base/lg), font weights (medium/semibold/bold)
- **Utilities**: Flexbox layout demo (justify-between), spacing/gap demos (gap-1 through gap-4), fade-in animation demo with toggle button

Each section uses the helper method `createSection(container, title, description)` for consistent layout.

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | This view has no event interactions |

## Related

- Standalone view, no child components
- Demonstrates CSS classes used across: [[EventCatalogView]], [[DataExchangeHubView]], [[CsvActionView]], [[ExportView]], [[EventLogView]]
