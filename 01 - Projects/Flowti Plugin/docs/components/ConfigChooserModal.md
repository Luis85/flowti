---
type: Component
domain: Flowti
stage: done
description: "Fuzzy-search modal for selecting a saved configuration or starting fresh"
source: "[[Development/flowti/src/ui/modals.ts|modals.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - modal
  - component
---

# ConfigChooserModal

## Description

A fuzzy-search suggest modal that presents a list of saved configurations for the user to choose from, plus a "Start fresh (no config)" option. It extends Obsidian's built-in `FuzzySuggestModal` to provide type-ahead filtering of configuration names. It is used in the CSV Import view, Export view, Pipeline Source modal, and the Data Exchange Hub whenever the user needs to load a previously saved import or export configuration.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | Obsidian API | FuzzySuggestModal base class |
| `FuzzySuggestModal<ConfigChooserItem>` | Obsidian API | Provides fuzzy matching and keyboard-navigable suggest UI |

## State

| Property | Type | Purpose |
|----------|------|---------|
| `items` | `ConfigChooserItem[]` | List of config items plus the "Start fresh" sentinel item |
| `onChooseConfig` | `(id: string \| null) => void` | Callback with the selected config ID, or `null` for "Start fresh" |

## Supporting Types

```typescript
interface ConfigChooserItem {
  id: string;    // Unique config identifier (or "__fresh__" for the sentinel)
  name: string;  // Display name shown in the suggest list
}
```

The sentinel item `{ id: "__fresh__", name: "Start fresh (no config)" }` is always appended as the last option.

## Renders

### Fuzzy Suggest List
- **Search input** with placeholder "Choose a config or start fresh..."
- **Filterable list** of config names (fuzzy matched as the user types)
- **"Start fresh (no config)"** always available as the last item

## Events

This modal does not interact with the EventBus. It uses a callback pattern:

| Callback | Direction | Purpose |
|----------|-----------|---------|
| `onChooseConfig(id: string \| null)` | Out | Returns the selected config ID, or `null` if the user chose "Start fresh" |

## Constructor Parameters

```typescript
constructor(
  app: App,
  configs: ConfigChooserItem[],              // Available saved configs
  onChoose: (id: string | null) => void,     // Selection callback
)
```

## Related

- Parent: [[PipelineSourceModal]], [[CsvActionView]], [[CsvLanding]], [[ExportView]], [[SourcesExportsGrid]]
- Siblings: [[InputModal]], [[ConfirmModal]]
