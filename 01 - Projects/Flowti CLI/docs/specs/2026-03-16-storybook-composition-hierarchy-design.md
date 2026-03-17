# Storybook Composition Hierarchy — Design Spec

**Date**: 2026-03-16
**Status**: draft
**Iteration**: Agent World (#5)
**Depends on**: Storybook Sitemap Integration (completed)

---

## Problem

The current Storybook generates one flat story per sitemap page showing actions as a key+label list. There is no visual composition — pages don't show their child components or navigation relationships. The sidebar has no meaningful structure beyond page kind.

## Goal

Reorganize the Storybook so that:

1. **Root pages come first** in the sidebar, ordered by navigation depth
2. **Pages visually embed their children** — inline primitives (stat grids, sections, lists) plus navigation cards for child pages
3. **Individual components are categorized** by function underneath the pages

## Decisions

- **HTML/Vite framework** — no React, no Ink shim layer. All stories use HTML factory functions wrapped in the terminal-view container.
- **Static mock data** — each story uses hardcoded mock data matching what the TUI loaders would return. No filesystem access, no loaders.
- **Navigation cards** for child pages — compact preview cards (title, description, action count), not full embedded terminal views.
- **Functional grouping** for components — Data Display, Navigation, Layout, Lists, Input.

---

## Sidebar Structure

```
Pages/
  Start Menu
  Project Detail
  Management
  Make
  Review
  Publish
  AI Tools
  Agent Detail
  Agent Edit
  Agents Chat
  Agents Dashboard
  Components (page)
  Component Detail
  Event Catalog
  Reports
  Requirements
  Docs
  Knowledgebase
  Dev Tools
  Resources
  Timelog
  Deliverables
  RAID
  CAPA
  Lifecycle
  Iterations
  Iteration Detail
  Iteration Planning
  Onboarding
  Onboarding Tour
  Onboarding Checklist
  Plugins
  Workspaces
Components/
  Data Display/
    StatCard
    StatGrid
    Badge
  Navigation/
    ActionBar
    KeyHints
    NavigationCard
  Layout/
    TerminalView
    Section
    MasterDetail
  Lists/
    ScrollableList
    SearchInput
  Input/
    FormField
```

Pages ordered by navigation depth (root first, then second-level). All 33 sitemap pages appear under `Pages/` regardless of their `kind`. Components grouped by function.

**Inclusion rule**: every page ID in `sitemap.json` gets a story under `Pages/`, regardless of `kind` (page, form, component, list, etc.). The `kind` influences which composition pattern is used, not whether the page appears.

---

## Page Story Composition

Each page story renders inside a `terminal-view` wrapper with three visual zones:

### 1. Page Header

Title and description from the sitemap page definition. Template tokens in labels (e.g. `{{project.name}}`, `{{params.agentName}}`) are replaced with mock values during story generation (e.g. "My Project", "Software Architect").

### 2. Page Content

Determined by the page's pattern type. Each pattern composes TUI primitives inline:

- **Dashboard**: StatGrid (2-4 cards) → Section blocks → ActionBar
- **List**: ScrollableList (3-5 items, one selected) → optional MasterDetail panel → ActionBar
- **Simple**: Grouped action-list (key + label with group separators) — the fallback

### 3. Navigation Cards

At the bottom of the page, one card per child page (derived from `navigate` and `form` type actions in the sitemap). Each card shows:

- Page label + icon
- One-line description
- Action count badge (e.g. "8 actions")
- Visual link indicator (arrow or accent border)

Navigation cards are generated automatically by reading the target page definition from the sitemap.

**Excluded from cards**: `signal` type actions (back, quit) and `command` type actions are not navigation targets — they don't point to other sitemap pages. Only `navigate` and `form` actions whose `target` matches another page ID in the sitemap produce cards. For pages with many navigation targets (e.g. `project-detail` with 12+), cards render in a 2-column grid to keep the layout compact.

---

## Pattern-to-Page Mapping

| Pattern | Pages |
|---------|-------|
| **Dashboard** | `start`, `project-detail`, `agent-detail`, `devtools`, `knowledgebase`, `make`, `plugins`, `publish`, `reports`, `review` |
| **List** | `ai-tools`, `iterations`, `resources`, `timelog`, `deliverables`, `raid`, `capa`, `lifecycle`, `requirements`, `event-catalog`, `components`, `workspaces`, `onboarding-tour`, `onboarding-checklist` |
| **Simple** | `management`, `docs`, `agents-chat`, `agents-dashboard`, `iteration-detail`, `component-detail`, `agent-edit`, `iteration-planning`, `onboarding` |

Pages without an explicit mapping fall back to Simple (action-list).

---

## Mock Data Strategy

A single `mock-data.ts` file contains typed mock objects for each page:

- **Dashboard mocks**: 2-4 `StatCardData` objects per page (domain-appropriate labels and values), 1-2 section titles with text content
- **List mocks**: 3-5 list items with one selected, detail panel content for the selected item
- **Navigation cards**: auto-generated from the page's `navigate`/`form` actions by reading the target page's label, description, and action count from the sitemap
- **Template tokens**: labels containing `{{project.name}}`, `{{params.agentName}}` etc. are replaced with mock values (e.g. "Flowti CLI", "Software Architect")

---

## Component Stories

Each component in `Components/` is a standalone story with:

- Storybook controls (argTypes) for all props
- `autodocs` tag for automatic documentation
- A Default story plus meaningful variants (e.g. StatCard with trend, Section collapsed, ScrollableList empty state)

### Component Inventory

| Category | Component | Props |
|----------|-----------|-------|
| **Data Display** | StatCard | label, value, trend?, color? |
| **Data Display** | StatGrid | stats[] |
| **Data Display** | Badge | text, color? |
| **Navigation** | ActionBar | actions[] (key + label) |
| **Navigation** | KeyHints | hints[] (key + description) |
| **Navigation** | NavigationCard | label, icon?, description, actionCount, onClick? |
| **Layout** | TerminalView | title, width?, showTitleBar? |
| **Layout** | Section | title, collapsible?, children |
| **Layout** | MasterDetail | master, detail?, masterWidth? |
| **Lists** | ScrollableList | items[], selected |
| **Lists** | SearchInput | placeholder, value?, onChange? |
| **Input** | FormField | label, type, value?, placeholder?, required?, options? |

---

## File Organization

```
components/
  .storybook/
    main.ts                 # Stories glob, html-vite framework, no telemetry
    preview.ts              # Dark background default, CSS imports
  terminal-view/
    terminal-view.ts        # createTerminalView() factory
    terminal-view.css       # Terminal window styling
    terminal-view.stories.ts
  tui/
    primitives.ts           # All HTML primitive factories
    primitives.css          # Primitive styling
    patterns.ts             # Dashboard, List, Simple page pattern factories
    nav-card.ts             # Navigation card factory
    nav-card.css            # Navigation card styling
  mocks/
    mock-data.ts            # Per-page mock data objects
  pages/
    *.stories.ts            # One story per sitemap page (generated)
  lib/
    data-display.stories.ts # StatCard, StatGrid, Badge stories
    navigation.stories.ts   # ActionBar, KeyHints, NavigationCard stories
    layout.stories.ts       # TerminalView, Section, MasterDetail stories
    lists.stories.ts        # ScrollableList, SearchInput stories
    input.stories.ts        # FormField stories
  package.json              # storybook, @storybook/html-vite, addon-essentials
```

---

## Terminal View Wrapping

Every page story wraps its content in `createTerminalView({ title: page.label })`. The terminal-view provides:

- Dark background (#1e1e2e)
- Title bar with dot-trio (red/yellow/green) and page title
- Monospace font (Cascadia Code / Fira Code / JetBrains Mono)
- Content area with padding

This gives every page the consistent CLI look regardless of its pattern type.

---

## Generation Flow

A Node.js script reads `configs/sitemap.json` and generates:

1. Per-page story files in `components/pages/` — selects the correct pattern factory, passes mock data and navigation cards
2. The script is run manually (not a watcher) — same as the existing sitemap import flow

Regeneration: when the sitemap changes, re-run the script. New pages get the Simple fallback pattern until explicitly mapped.
