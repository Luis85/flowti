---
type: Component
domain: Flowti
stage: done
description: "Simple confirmation dialog with a message and confirm/cancel buttons"
source: "[[Development/flowti/src/ui/modals.ts|modals.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - modal
  - component
---

# ConfirmModal

## Description

A lightweight confirmation dialog that displays a message with Cancel and Confirm buttons. It is used throughout the plugin wherever a destructive or irreversible action requires user confirmation, such as deleting watchers, transforms, documents, or pipeline entries. The confirm button is styled with a warning appearance to indicate the action's severity.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | Obsidian API | Modal base class |
| `Setting` | Obsidian API | Button layout via Obsidian's Setting component |

## State

| Property | Type | Purpose |
|----------|------|---------|
| `message` | `string` | The confirmation message displayed to the user |
| `confirmLabel` | `string` | Label for the confirm button (defaults to "Confirm") |
| `onConfirm` | `() => void` | Callback executed when the user clicks confirm |

## Renders

### Single Page
- **Message paragraph**: the confirmation text
- **Button row** (via `Setting`):
  - **Cancel button**: closes the modal without action
  - **Confirm button**: styled with `.setWarning().setCta()`, executes `onConfirm` callback and closes

## Events

This modal does not interact with the EventBus. It uses a callback pattern:

| Callback | Direction | Purpose |
|----------|-----------|---------|
| `onConfirm()` | Out | Executed when the user confirms the action |

## Constructor Options

```typescript
{
  message: string;          // Text to display
  confirmLabel?: string;    // Button label (default: "Confirm")
  onConfirm: () => void;    // Action on confirm
}
```

## Related

- Parent: [[EventConfigModal]], [[EventCatalogView]], and many other views
- Siblings: [[InputModal]], [[CreateEventModal]]
