---
type: Component
domain: Flowti
stage: done
description: "Lightweight folder autosuggest dropdown that attaches to text inputs for vault folder selection"
source: "[[Development/flowti/src/ui/FolderSuggest.ts|FolderSuggest.ts]]"
parent: "[[SessionActivityPanel]]"
tags:
  - shared
  - component
---

# FolderSuggest

## Description

FolderSuggest provides the `attachFolderSuggest()` function that enhances a text input with folder autosuggest behavior. As the user types, a dropdown appears showing matching vault folder paths (max 10 results). Supports keyboard navigation (Arrow Up/Down/Enter/Escape) and mouse selection. The dropdown auto-hides on blur with a 150ms delay.

## Exports

| Export | Purpose |
|--------|---------|
| `attachFolderSuggest(input, app, onSelect?)` | Attaches autosuggest to an input element |

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `App` | obsidian | Vault access for listing folders |

## Renders

- Absolute-positioned dropdown below input element
- Items styled with hover highlight, pointer cursor
- Max height 200px with overflow scroll
- Box shadow for visual layering

## Consumers

- [[SessionActivityPanel]] — folder exclusion filter input
- [[FlowtiSettingTab]] — docs root path input

## Related

- No events emitted — uses callback pattern via `onSelect` parameter
