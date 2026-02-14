---
type: Component
domain: Flowti
stage: done
description: "Generic single text input modal with configurable title, label, and submit callback"
source: "[[Development/flowti/src/ui/modals.ts|modals.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - modal
  - component
---

# InputModal

## Description

A general-purpose modal that presents a single text input field with configurable title, placeholder, default value, input label, description, and submit button text. It is the most widely used modal in the plugin, invoked from the Event Catalog dashboard (for creating flows, systems, actors, products, domains, services), tab views, the Data Exchange Hub, and the CSV/Export views whenever a simple text value is needed from the user.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | Obsidian API | Modal base class |
| `Setting` | Obsidian API | Input field and button layout |

## State

| Property | Type | Purpose |
|----------|------|---------|
| `title` | `string` | Heading text shown at the top of the modal |
| `placeholder` | `string` | Placeholder text for the input field (default: empty) |
| `defaultValue` | `string` | Pre-filled value for the input field (default: empty) |
| `submitLabel` | `string` | Label for the submit button (default: "Create") |
| `inputName` | `string` | Label for the input setting row (default: "Event name") |
| `inputDesc` | `string` | Description text below the input label (default: "Use dot notation (e.g. my.custom.event)") |
| `onSubmit` | `(value: string) => void` | Callback with the trimmed input value |

## Renders

### Single Page
- **Title heading** (`h3`): configurable via `title` option
- **Input field** (via `Setting`): single text input with configurable name, description, and placeholder
- **Button row** (via `Setting`):
  - **Cancel button**: closes the modal without action
  - **Submit button**: styled as CTA, validates that input is non-empty after trimming, then calls `onSubmit` and closes

## Events

This modal does not interact with the EventBus. It uses a callback pattern:

| Callback | Direction | Purpose |
|----------|-----------|---------|
| `onSubmit(value: string)` | Out | Returns the trimmed text value to the caller |

## Validation

- Input must be non-empty after trimming; empty inputs are silently ignored (button click does nothing)

## Constructor Options

```typescript
{
  title: string;             // Modal heading
  placeholder?: string;      // Input placeholder
  defaultValue?: string;     // Pre-filled input value
  submitLabel?: string;      // Submit button label (default: "Create")
  inputName?: string;        // Input field label (default: "Event name")
  inputDesc?: string;        // Input field description
  onSubmit: (value: string) => void;  // Callback with trimmed value
}
```

## Related

- Parent: [[CatalogDashboard]], [[FlowsTab]], [[SystemsTab]], [[ActorsTab]], [[ProductsTab]], [[DomainsTab]], [[ServicesTab]], [[EventsCategoryRenderer]], [[CsvActionView]], [[ExportView]], [[PipelinesTab]], [[TypesTab]]
- Siblings: [[ConfirmModal]], [[CreateEventModal]]
