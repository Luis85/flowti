---
type: Learning
id: L-14
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 7
domain: ui
tags:
  - learning
  - ui
  - architecture
---

# L-14: Standalone views don't need BaseHubView

Inc 7 (`SessionWorkspaceView`) extends `ItemView` directly because it's a single-purpose focused workspace, not a tabbed hub. BaseHubView's tab bar, search, and split layout would have been unnecessary overhead. Choose the base class that matches the view's purpose — not every view needs a hub shell.

## Pattern

- **BaseHubView**: for multi-tab, split-layout hub views with search and navigation (Event Catalog, Data Exchange Hub)
- **ItemView**: for single-purpose, focused views (Session Workspace, Component Library)
- Choose based on purpose, not convention

## When to Apply

- When creating a new view: ask "does this need tabs, search, and split layout?"
- If no, extend `ItemView` directly — it's simpler and has less overhead
