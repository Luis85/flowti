---
type: Component
domain: Flowti
stage: done
description: "Modal for creating a new custom event with an optional category assignment"
source: "[[Development/flowti/src/ui/modals.ts|modals.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - modal
  - component
---

# CreateEventModal

## Description

A single-page modal for creating a new custom event in the Event Catalog. It collects an event name (in dot notation) and an optional category, then invokes a callback with the values. It is opened from the Catalog Dashboard's "New Event" quick action and from the `EventsCategoryRenderer` when adding events to a category or creating uncategorized events.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | Obsidian API | Modal base class |
| `Setting` | Obsidian API | Input fields and button layout |

## State

| Property | Type | Purpose |
|----------|------|---------|
| `title` | `string` | Heading text shown at the top of the modal |
| `existingCategories` | `string[]` | List of current category names shown as a hint below the category field |
| `onSubmit` | `(eventName: string, category?: string) => void` | Callback with the event name and optional category |

Local variables during render:

| Variable | Type | Purpose |
|----------|------|---------|
| `eventName` | `string` | Current value of the event name input |
| `category` | `string` | Current value of the category input |

## Renders

### Single Page
- **Title heading** (`h3`): configurable via `title` option
- **Event name input** (via `Setting`): text field with placeholder "my.custom.event" and description "Use dot notation (e.g. order.placed)"
- **Category input** (via `Setting`): text field with placeholder "optional" and description "Group this event under a category (e.g. Orders)"
- **Existing categories hint**: if categories exist, shows "Existing: Category1, Category2, ..." as a muted text hint below the category input
- **Button row** (via `Setting`):
  - **Cancel button**: closes the modal without action
  - **Create button**: styled as CTA, validates event name is non-empty, calls `onSubmit` with trimmed name and optional category, then closes

## Events

This modal does not interact with the EventBus directly. It uses a callback pattern:

| Callback | Direction | Purpose |
|----------|-----------|---------|
| `onSubmit(eventName, category?)` | Out | Returns the event name and optional category to the caller |

## Validation

- Event name must be non-empty after trimming
- Category is optional; empty category is passed as `undefined`

## Constructor Options

```typescript
{
  title: string;                    // Modal heading
  existingCategories?: string[];    // Shown as hint text (default: [])
  onSubmit: (eventName: string, category?: string) => void;
}
```

## Related

- Parent: [[CatalogDashboard]], [[EventsCategoryRenderer]]
- Siblings: [[InputModal]], [[ConfirmModal]]
