# Ink TUI Migration — Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Scope:** Replace the entire Flowti CLI ANSI/readline UI with an Ink-based modern TUI

## Problem Statement

The current CLI UI uses a clear-and-redraw ANSI/readline loop (`menu.ts → printHeader → readline → clear screen`). This produces a workable but dated experience: no persistent layout, no scrollable content, no differential updates, no split panels. The agent chat shell already proves Ink works well for rich terminal UI. Time to bring the whole CLI up to that standard.

## Target UX

A persistent terminal application with:
- **Activity bar** (left edge) — icon column for major sections, always visible
- **Header bar** (top) — breadcrumb path, project name, status indicators
- **Content area** (center) — the active page rendered as an Ink component
- **Status bar** (bottom) — agent status, active tasks, key hints
- Keyboard-driven: arrow keys, Enter, Escape, tab. No single-key-press menus.
- Scrollable lists with selection highlighting
- Master-detail split panels where appropriate

```
┌──┬────────────────────────────────────────────────┐
│  │ Flowti CLI > Agents > Bob                      │ ← Header
│🏠│                                                │
│👤│  ┌─ Master ──────────┐ ┌─ Detail ────────────┐ │
│📊│  │ > Bob          ●  │ │ Status: busy        │ │
│⚡│  │   Alice           │ │ Task: Add auth      │ │
│🔧│  │   Charlie         │ │ Skills: TDD, Debug  │ │
│  │  │                   │ │                     │ │
│  │  └───────────────────┘ └─────────────────────┘ │ ← Content
│  │                                                │
├──┴────────────────────────────────────────────────┤
│ ↑↓ Navigate  Enter Select  Esc Back  ? Help      │ ← Status bar
└───────────────────────────────────────────────────┘
```

## Architecture

### Layout Shell

A single React component tree that never unmounts:

```
<App>
  <Box flexDirection="row" height="100%">
    <ActivityBar sections={sections} active={activeSection} onSelect={setSection} />
    <Box flexDirection="column" flexGrow={1}>
      <HeaderBar breadcrumbs={breadcrumbs} project={project} />
      <ContentArea>
        {renderPage(activePage)}
      </ContentArea>
      <StatusBar hints={keyHints} agentStatus={agentStatus} />
    </Box>
  </Box>
</App>
```

### Activity Bar Sections

Derived from sitemap.json groups. Each section maps to a set of pages:

| Icon | Section | Pages |
|------|---------|-------|
| 🏠 | Home | start, dashboard |
| 👤 | Agents | agents, agent-detail, agents-chat, agents-run |
| 📋 | Project | project-info, build, test, health, scaffold, make |
| 📊 | Reports | reports, report-archive |
| ⚡ | Events | event-catalog, event-config |
| 🔧 | Management | iterations, lifecycle, resources, timelog, deliverables, raid, requirements, capa |
| 📦 | Publish | publish, plugins |
| ❓ | Help | help, onboarding, knowledgebase |

Arrow up/down on the activity bar switches sections. The first page in each section loads automatically.

### Page Components

Each sitemap page becomes an Ink component. Three page patterns cover all 28 pages:

**1. ListPage** — scrollable list with optional detail panel (master-detail)
Used by: agents, iterations, resources, deliverables, raid, requirements, capa, timelog, reports, event-catalog, plugins, knowledgebase

```tsx
<ListPage
  items={items}
  selected={selected}
  onSelect={setSelected}
  renderItem={(item) => <AgentRow agent={item} />}
  renderDetail={(item) => <AgentDetail agent={item} />}
  actions={[
    { key: "n", label: "New", action: handleNew },
    { key: "d", label: "Delete", action: handleDelete },
  ]}
/>
```

**2. DashboardPage** — grid of stat cards + sections
Used by: start, project-info, health, build, test

```tsx
<DashboardPage>
  <StatGrid stats={stats} columns={4} />
  <Section title="Recent Activity">
    <ActivityList items={recent} />
  </Section>
</DashboardPage>
```

**3. FormPage** — structured input form
Used by: scaffold, make, capture, publish, lifecycle transitions

```tsx
<FormPage
  fields={fields}
  onSubmit={handleSubmit}
  onCancel={() => navigate("back")}
/>
```

### Navigation

Replace `SitemapRouter` with a React state machine:

```typescript
interface NavigationState {
  section: string;           // activity bar selection
  pageStack: string[];       // breadcrumb path (push on navigate, pop on Escape)
  params: Record<string, string>; // page params (e.g., agent name)
}
```

- `navigate(pageId, params?)` — push onto stack
- `Escape` — pop stack (back)
- Activity bar click — reset stack to section root
- Breadcrumb click — pop to that level

### Input Model

Replace readline with Ink's `useInput` hook:

| Context | Keys | Action |
|---------|------|--------|
| Global | ↑/↓ | Navigate lists, activity bar |
| Global | Enter | Select/confirm |
| Global | Escape | Back (pop navigation stack) |
| Global | Tab | Cycle focus (activity bar ↔ content ↔ actions) |
| Global | ? | Toggle key hints overlay |
| List | / | Start search/filter (inline) |
| List | j/k | Vim-style up/down (alternative) |
| Form | Tab | Next field |
| Form | Shift+Tab | Previous field |
| Detail | a | Actions menu (contextual) |
| Chat | (existing) | Full chat input area |

### Rendering Pipeline (new)

```
sitemap.json → sections/pages
     ↓
App (Ink root, never unmounts)
  ├── ActivityBar (useInput for section switching)
  ├── HeaderBar (reads navigation state)
  ├── ContentArea
  │     └── PageComponent (switched by activePage)
  │           ├── domain function call (same as before)
  │           ├── controller call → CliResponse<T>
  │           └── Ink components render typed data
  └── StatusBar (key hints, agent status)
```

**Key difference from current:** No clear-and-redraw. Ink's virtual DOM diffs and patches only what changed. Lists scroll without clearing the screen.

### Data Flow

Controllers and domain functions remain unchanged. The difference is in how data reaches the screen:

**Before:**
```
controller → CliResponse<T> → renderer(data, log) → log(ANSI string) → stdout
```

**After:**
```
controller → CliResponse<T> → React state → <PageComponent data={data} /> → Ink render
```

The `CliResponse<T>` pattern is preserved — the `T` typed data model is the same, only the renderer changes from `(data, log) => void` to a React component.

## Migration Strategy

### Phase 0: Shell (foundation)
Create the layout shell: `App`, `ActivityBar`, `HeaderBar`, `ContentArea`, `StatusBar`, navigation state machine. Wire to `main.ts` as the new entry point. The content area renders a placeholder "Coming soon" for all pages except chat (which already works).

**Deliverable:** Ink app boots, activity bar navigates between sections, chat still works, all other pages show placeholder.

### Phase 1: Core primitives
Build the 3 reusable page patterns: `ListPage`, `DashboardPage`, `FormPage`. Build shared components: `ScrollableList`, `MasterDetail`, `StatCard`, `StatGrid`, `Section`, `Badge`, `KeyHints`, `SearchInput`, `ActionBar`.

**Deliverable:** Component library with storybook-style test harness.

### Phase 2: High-traffic pages
Migrate the most-used pages: `start` (dashboard), `agents` (list+detail), `project-info`, `health`, `iterations`.

**Deliverable:** Core workflow is fully Ink. Users can navigate agents, view project health, manage iterations.

### Phase 3: Management pages
Migrate CRUD pages: `resources`, `timelog`, `deliverables`, `raid`, `requirements`, `capa`, `lifecycle`.

**Deliverable:** All management domains have Ink pages.

### Phase 4: Tooling pages
Migrate: `build`, `test`, `scaffold`, `make`, `reports`, `publish`, `plugins`, `event-catalog`, `knowledgebase`, `help`, `onboarding`.

**Deliverable:** Full migration. All 28 pages are Ink components.

### Phase 5: Cleanup
Delete: `menu.ts`, `ui.ts` (ANSI helpers), `input.ts` (readline), `sitemap-router.ts`, all `src/ui/menus/*.ts`, all `src/ui/displays/*.ts`. Update `sitemap.json` to reference Ink components. Remove ANSI dependencies.

**Deliverable:** Clean codebase with zero legacy UI code.

## File Structure (target state)

```
src/
├── tui/
│   ├── app.tsx                          # Root Ink component
│   ├── shell/
│   │   ├── activity-bar.tsx             # Left icon column
│   │   ├── header-bar.tsx               # Top breadcrumb bar
│   │   ├── status-bar.tsx               # Bottom key hints + status
│   │   └── content-area.tsx             # Page switcher
│   ├── navigation/
│   │   ├── use-navigation.ts            # Navigation state hook
│   │   ├── use-keyboard.ts              # Global keyboard handler
│   │   └── section-map.ts              # Sitemap → section grouping
│   ├── primitives/
│   │   ├── scrollable-list.tsx          # Arrow-key scrollable list
│   │   ├── master-detail.tsx            # Split panel layout
│   │   ├── stat-card.tsx                # Single KPI card
│   │   ├── stat-grid.tsx                # Grid of stat cards
│   │   ├── section.tsx                  # Titled content section
│   │   ├── badge.tsx                    # Colored inline badge
│   │   ├── search-input.tsx             # Inline search/filter
│   │   ├── action-bar.tsx               # Contextual action buttons
│   │   ├── form-field.tsx               # Form input (text, select, toggle)
│   │   └── key-hints.tsx                # Bottom-bar key legend
│   ├── pages/
│   │   ├── list-page.tsx                # Generic list+detail page
│   │   ├── dashboard-page.tsx           # Generic dashboard page
│   │   ├── form-page.tsx                # Generic form page
│   │   ├── start-page.tsx               # Home dashboard
│   │   ├── agents-page.tsx              # Agent list + detail
│   │   ├── agent-detail-page.tsx        # Single agent deep view
│   │   ├── iterations-page.tsx          # Iteration list + detail
│   │   ├── project-info-page.tsx        # Project dashboard
│   │   ├── health-page.tsx              # Health dashboard
│   │   ├── build-page.tsx               # Build output view
│   │   ├── test-page.tsx                # Test output view
│   │   ├── reports-page.tsx             # Report list
│   │   ├── resources-page.tsx           # Resource CRUD
│   │   ├── ... (one per sitemap page)
│   │   └── chat-page.tsx                # Wraps existing chat shell
│   └── hooks/
│       ├── use-domain.ts                # Domain function caller hook
│       ├── use-controller.ts            # Controller caller hook
│       └── use-focus-zone.ts            # Focus management
├── infrastructure/chat/                 # Existing — absorbed into tui/pages/chat-page.tsx
├── domain/                              # UNCHANGED
├── controller/                          # UNCHANGED
└── main.ts                              # Updated: boots Ink app instead of SitemapRouter
```

## Shared Infrastructure with Existing Chat

The existing chat components (`header-bar.tsx`, `activity-bar.tsx`, etc.) were built for the chat-only context. In the new TUI:

- `HeaderBar` → replaced by `tui/shell/header-bar.tsx` (breadcrumbs instead of agent name)
- `ActivityBar` → new concept (section icons, not chat status)
- `InputArea` → reused inside `chat-page.tsx`
- `MessageArea` → reused inside `chat-page.tsx`
- `TaskView` → reused inside `chat-page.tsx`
- `ToolPanel` → reused inside `chat-page.tsx`

The chat components become a page within the TUI shell rather than a standalone Ink app.

## Key Design Decisions

1. **Ink takes over immediately** — `main.ts` renders `<App />` on startup. No fallback to ANSI.
2. **Sitemap.json stays** — sections and pages derived from it. Page components registered by ID.
3. **Controllers unchanged** — `CliResponse<T>` data models are the props for page components.
4. **One Ink instance** — never unmounted. Pages switch via React state, not mount/unmount cycles.
5. **Focus zones** — Tab cycles between activity bar, content, and action bar. Within content, arrow keys navigate.
6. **Non-interactive mode preserved** — `flowti info --format=json` bypasses Ink entirely (direct stdout).

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Terminal compatibility (Windows ConPTY, SSH) | High | Ink 6 handles this; chat shell already works on Windows |
| Migration takes too long (28 pages) | High | Phase by phase; each phase ships independently |
| Test coverage drops during migration | Medium | Page components tested with ink-testing-library |
| Performance with large lists (1000+ items) | Medium | Virtual scrolling via windowed list component |
| Non-interactive CLI breaks | Low | Non-interactive path is separate (controller → stdout, no Ink) |

## Non-Goals

- Web UI or browser rendering
- Mouse support (keyboard-only)
- Theming system (use Flowti design tokens directly)
- Plugin system for custom pages (pages are hardcoded to sitemap)
- Responsive layout for narrow terminals (minimum 80 columns assumed)
