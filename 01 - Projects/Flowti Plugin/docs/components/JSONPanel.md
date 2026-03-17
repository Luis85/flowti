---
type: Component
domain: JourneyBuilder
stage: done
description: "Collapsible JSON preview panel — formatted journey definition, copy-to-clipboard, live update without full re-render"
source: "[[Development/flowti/src/ui/journeyBuilder/JSONPanel.ts|JSONPanel.ts]]"
tags:
  - journey-builder
  - component
---

# JSONPanel

## Description

JSONPanel renders a collapsible panel at the bottom of the step editor showing the generated journey JSON definition. The panel supports collapse/expand toggle, copy-to-clipboard with icon feedback, and a live `update()` method that refreshes content without rebuilding the DOM.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `setIcon` | obsidian | Icons for toggle (chevron-down/right) and copy (copy/check) |

## State

**Via deps:**
- `getJSON: () => string` — Callback to get current journey JSON
- `collapsed?: boolean` — Initial collapse state (default false)

**Internal:**
- `collapsed: boolean` — Current toggle state
- `preEl: HTMLPreElement | null` — Reference for live content updates

## Renders

- **Toggle header**: "JSON Preview" label with chevron icon, clickable
- **Code block**: `<pre>` with formatted JSON content (monospace)
- **Copy button**: copies raw JSON to clipboard, shows checkmark icon for 1.5s feedback
- **Empty state**: hidden when collapsed

## API

| Method | Purpose |
|--------|---------|
| `render()` | Full DOM rebuild — toggle header, code block, copy button |
| `update()` | Live content refresh — updates `<pre>` text without DOM rebuild |

## Related

- Parent: [[JourneyBuilderSidebar]]
- Test: `tests/ui/journeyBuilder/JSONPanel.test.ts` (15 tests)
- Source: `src/ui/journeyBuilder/JSONPanel.ts` (95 LOC)
