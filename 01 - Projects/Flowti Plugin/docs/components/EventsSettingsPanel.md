---
type: Component
domain: Flowti
stage: done
description: "Settings sidebar for the Events tab with filter toggles, system event toggle, and category ordering"
source: "[[Development/flowti/src/ui/catalog/EventsSettingsPanel.ts|EventsSettingsPanel.ts]]"
parent: "[[EventCatalogView]]"
tags:
  - catalog
  - component
---

# EventsSettingsPanel

## Description

EventsSettingsPanel renders the settings sidebar for the Events tab. It provides toggle controls for filtering events by configured or followed status, a toggle to show/hide system events, a category visibility and ordering section (with up/down reorder arrows), and a reset button to restore default category settings. It is implemented as a standalone `renderEventsSettingsPanel()` function rather than a class.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CatalogComponentDeps` | interface | Provides `getState()`, `eventBus`, `getEntityFolder`, `vaultQuery` |
| `EventsSettingsPanelCallbacks` | interface | Provides filter chip state and toggle callbacks from EventsTab |
| `DEFAULT_CATALOG_CATEGORIES` | constant | Default category configuration for the reset button |
| `getOrderedCategories` | helper | Retrieves categories in their configured order |
| `getConfiguredCount`, `getFollowedCount` | helpers | Compute counts for filter chip labels |

## State

**Reads from `deps.getState()`:**
- `catalogCategories` -- current category visibility and ordering configuration
- `showSystemEvents` -- whether system events toggle is on
- `discoveredEvents` -- for computing configured/followed counts
- `subscriptions`, `definitions` -- for configured count
- `notifiedTypes` -- for followed count

**Reads from `callbacks`:**
- `filterChipConfigured` -- current state of the "Only configured" toggle
- `filterChipFollowed` -- current state of the "Only followed" toggle

## Renders

- **Configured filter toggle**: eye icon + "Only configured (N)" label; toggles via `onToggleConfigured` callback
- **Followed filter toggle**: eye icon + "Only followed (N)" label; toggles via `onToggleFollowed` callback
- **System events toggle**: eye icon + "Show system events" label; emits settings event directly
- **Category visibility section** (shown only when system events are enabled):
  - Per-category row with: visibility eye toggle, category name, up/down reorder arrows
  - Disabled arrows at list boundaries
- **Hint text**: "Enable system events to configure category visibility." when system events are off
- **Reset button**: "Reset to defaults" restores `DEFAULT_CATALOG_CATEGORIES`

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `settings.updateShowSystemEvents` | Emits | Toggles system event display |
| `settings.updateCatalogCategories` | Emits | Persists category visibility changes, reorder operations, or reset |

## Related

- Parent: [[EventsTab]]
- Siblings: [[EventsCategoryRenderer]], [[EventDetailPanel]]
- Children: none
