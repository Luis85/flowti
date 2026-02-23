---
type: Component
domain: Flowti
stage: done
description: "Event definition form for creating/editing source-to-domain event mappings with payload mapping repeater"
source: "[[Development/flowti/src/ui/eventConfig/DefinitionFormPage.ts|DefinitionFormPage.ts]]"
parent: "[[EventConfigModal]]"
tags:
  - eventConfig
  - component
---

# DefinitionFormPage

## Description

`renderDefinitionFormPage()` is a free function that renders the event definition form (page 2) within the EventConfigModal. It provides fields for configuring how a source event is mapped to a domain event: output event name, file pattern filter, trigger mode (always/once per file), and a repeater for payload mappings (field name, source type, expression).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `EventConfigPageDeps` | Shared dependency bag with entry, form state, callbacks |
| `deps.entry` | `EventEntry` | Source event type (displayed as disabled field) |
| `deps.defFormData` | `object` | Form state: outputEventName, filePattern, emissionPolicy, payloadMappings |
| `deps.editingDefinitionId` | `string \| null` | Non-null when editing existing definition |
| `deps.onNavigateToPage()` | callback | Navigate back to overview page |

## Renders

- **Source event type** (disabled): Shows the triggering event name
- **Output event name**: Text input with dot-notation namespace convention
- **File pattern**: Glob pattern input (optional, defaults to all files)
- **Trigger mode**: Dropdown — "always" (emit every time) or "once" (deduplicate per file)
- **Payload mappings repeater**: Each row has field name, source type (path/metadata/derived), expression, and remove button. "Add mapping" button appends new rows
- **Action buttons**: Cancel (→ overview), Create/Save (emits event, → overview)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `eventDefinition.create` | Emits | Create new event definition |
| `eventDefinition.update` | Emits | Update existing event definition |

## Related

- Parent: [[EventConfigModal]]
- Siblings: [[OverviewPage]]
