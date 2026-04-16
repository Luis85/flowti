---
title: Agentonomous — UI Architecture (Increment 5)
date: 2026-04-16
status: approved-for-planning
author: Luis Mendez
project: Agentonomous
---

# Agentonomous — UI Architecture (Increment 5)

## 1. Purpose & Scope

Increments 1-4 built a framework with a module system, typed EventBus, structured logging, vault access, and i18n. The UI layer has been minimal — a few pages, no layout system, no testing patterns. Increment 5 introduces **UI architecture**: layouts as first-class components, PageObject pattern for test/Storybook unification, and a Dashboard page that proves the grid layout.

**In scope**
- Three layout components: `MainLayout`, `PanelLayout`, `DashboardLayout`
- Router-meta-driven layout resolution in `AppRoot.vue`
- PageObject pattern: `.po.ts` files co-located with pages/components, shared by Storybook `play` + Vitest
- `data-testid` convention for all interactive/assertable elements
- Dashboard page inside `DashboardLayout` showing module status cards
- Refactor existing pages/components: add `data-testid`, create POs, rewrite tests to use POs
- Storybook stories for all three layouts + updated page stories with `play` interactions

**Out of scope**
- Responsive/mobile layout adaptation (desktop-only per `isDesktopOnly: true`)
- Complex routing (guards, nested routes, transitions)
- `eslint-plugin-testing-library` enforcement of `data-testid` (convention-based for now)
- Agent/economy pages (business logic)

## 2. Layout System

### 2.1 Three layouts

```
src/ui/layouts/
├── MainLayout.vue       # full-width: optional header + content area + nav
├── PanelLayout.vue      # compact sidebar: title bar + scrollable content
└── DashboardLayout.vue  # grid: header + sidebar nav + card grid area
```

Each layout is a Vue SFC with a `<slot />` for page content. Layouts own structural chrome (padding, navigation, header); pages own content.

### 2.2 `MainLayout.vue`

```vue
<template>
	<div class="agentonomous-layout agentonomous-layout--main">
		<header class="layout-header" data-testid="layout-header">
			<slot name="header" />
		</header>
		<main class="layout-content" data-testid="layout-content">
			<slot />
		</main>
	</div>
</template>
```

Default slot for page content. Optional `header` named slot. Used by Homepage, About.

### 2.3 `PanelLayout.vue`

```vue
<template>
	<div class="agentonomous-layout agentonomous-layout--panel">
		<header class="panel-header" data-testid="panel-header">
			<slot name="header" />
		</header>
		<div class="panel-content" data-testid="panel-content">
			<slot />
		</div>
	</div>
</template>
```

Compact, scrollable. Used by Event Inspector sidebar, File Detail sidebar.

### 2.4 `DashboardLayout.vue`

```vue
<template>
	<div class="agentonomous-layout agentonomous-layout--dashboard">
		<header class="dashboard-header" data-testid="dashboard-header">
			<slot name="header" />
		</header>
		<aside class="dashboard-sidebar" data-testid="dashboard-sidebar">
			<slot name="sidebar" />
		</aside>
		<main class="dashboard-main" data-testid="dashboard-main">
			<slot />
		</main>
	</div>
</template>
```

CSS grid: `grid-template-areas: "header header" "sidebar main"`. Named slots for header + sidebar; default slot for main content.

### 2.5 Route-meta layout resolution

`AppRoot.vue` dynamically resolves the layout:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import MainLayout from './layouts/MainLayout.vue';
import PanelLayout from './layouts/PanelLayout.vue';
import DashboardLayout from './layouts/DashboardLayout.vue';

const route = useRoute();

const layouts = {
	main: MainLayout,
	panel: PanelLayout,
	dashboard: DashboardLayout,
} as const;

type LayoutName = keyof typeof layouts;

const LayoutComponent = computed(() => {
	const name = (route.meta.layout as LayoutName | undefined) ?? 'main';
	return layouts[name] ?? MainLayout;
});
</script>

<template>
	<component :is="LayoutComponent">
		<router-view />
	</component>
</template>
```

Routes declare their layout in `meta`:

```ts
{ path: '/', name: 'home', component: Home, meta: { layout: 'main' } }
{ path: '/about', name: 'about', component: About, meta: { layout: 'main' } }
{ path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { layout: 'dashboard' } }
```

Routes without `meta.layout` default to `MainLayout`.

Sidebar views (Event Inspector, File Detail) mount their own Vue app with a single-route router where the layout is `panel`.

### 2.6 Layout styles

```
styles/
├── base.css              # existing — reset + tokens
├── homepage.css          # existing — HelloCard
└── layouts.css           # NEW — grid definitions for all three layouts
```

`layouts.css` uses CSS grid with Obsidian CSS variables for colors and spacing. All layout classes prefixed `agentonomous-layout--*` to avoid Obsidian CSS collisions.

## 3. PageObject Pattern

### 3.1 File convention

```
src/ui/pages/Home.vue
src/ui/pages/Home.po.ts          ← PageObject
stories/pages/Home.stories.ts    ← uses Home.po.ts in play()
tests/ui/pages/Home.test.ts      ← uses Home.po.ts
```

POs live next to their page/component with `.po.ts` suffix. They are NOT in `tests/` — they are part of the component's public test interface.

### 3.2 PageObject shape

```ts
// src/ui/pages/Home.po.ts
export class HomePage {
	constructor(private readonly root: HTMLElement) {}

	get greeting(): string {
		return this.el('greeting')?.textContent?.trim() ?? '';
	}

	get version(): string {
		return this.el('version')?.textContent?.trim() ?? '';
	}

	get aboutLink(): HTMLElement | null {
		return this.el('nav-about');
	}

	async navigateToAbout(): Promise<void> {
		this.aboutLink?.click();
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
```

### 3.3 Rules

1. **Query only via `data-testid`** — never by class, tag, or text content. Decouples tests from styling.
2. **Expose semantic accessors** — `greeting`, `version`, `navigateToAbout()`, not raw DOM.
3. **Constructor takes `HTMLElement`** — works with `@vue/test-utils` (`wrapper.element`), Storybook `canvasElement`, and raw DOM.
4. **No Vue/Pinia dependency** — POs are plain classes. They don't mount components or create stores.
5. **Private `el(testId)` helper** — every PO has this shared accessor; DRY within the class.
6. **Async interactions return `Promise<void>`** — click + wait patterns for router navigation.

### 3.4 Storybook usage

```ts
// stories/pages/Home.stories.ts
import { HomePage } from '../src/ui/pages/Home.po.js';
import { expect } from 'vitest';

export const RendersGreeting: Story = {
	play: async ({ canvasElement }) => {
		const page = new HomePage(canvasElement);
		expect(page.greeting).toContain('Agentonomous');
		expect(page.version).toMatch(/\d+\.\d+\.\d+/);
	},
};

export const NavigatesToAbout: Story = {
	play: async ({ canvasElement }) => {
		const page = new HomePage(canvasElement);
		await page.navigateToAbout();
	},
};
```

### 3.5 Vitest usage

```ts
// tests/ui/pages/Home.test.ts
import { HomePage } from '../../../src/ui/pages/Home.po.js';

it('renders greeting from store', () => {
	const wrapper = mount(Home, { global: { plugins: [pinia, router] } });
	const page = new HomePage(wrapper.element as HTMLElement);
	expect(page.greeting).toContain('Agentonomous');
});
```

### 3.6 Component POs

Components with interactive or assertable elements also get POs:

```
src/ui/components/HelloCard.vue
src/ui/components/HelloCard.po.ts
```

```ts
export class HelloCardPO {
	constructor(private readonly root: HTMLElement) {}
	get title(): string { return this.root.querySelector('[data-testid="card-title"]')?.textContent?.trim() ?? ''; }
	get message(): string { return this.root.querySelector('[data-testid="card-message"]')?.textContent?.trim() ?? ''; }
}
```

## 4. `data-testid` Convention

All interactive or assertable elements get `data-testid`:

```vue
<HelloCard data-testid="greeting" ... />
<router-link data-testid="nav-about" to="/about">About</router-link>
<p data-testid="version">{{ pluginVersion }}</p>
```

**Naming:** kebab-case, scoped by context. No global uniqueness required — POs scope queries to their root element.

**Which elements get testids:**
- User-visible text that tests assert on (headings, version, status)
- Interactive elements (links, buttons, inputs, toggles)
- Container elements that POs need as scope boundaries (cards, list items)

**Which don't:**
- Purely structural elements (wrappers, spacers)
- Elements only relevant to styling

## 5. Dashboard Page

### 5.1 Purpose

A landing page inside `DashboardLayout` showing module status. Proves the grid layout + named slots + cards pattern. The developer's "home base" for the plugin.

### 5.2 Route

```ts
{ path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { layout: 'dashboard' } }
```

### 5.3 Content

- **Header slot:** Plugin name + version (from `useAppStore`)
- **Sidebar slot:** Navigation links (Home, Dashboard, About) as `<router-link>` elements
- **Main slot (default):** Module status cards — one card per loaded module

### 5.4 Module status cards

Each card shows:
- Module `name`
- Status: `ready` | `degraded` | `not loaded`
- A colored indicator (green/yellow/red) using Obsidian CSS variables

Data source: `PluginCore` exposes module status. The Dashboard reads it via a new `useModuleStatusStore` that queries the core's module list + `degradedModules`.

Since the store needs data from `PluginCore` (which is in `src/core/`), the store receives the data via `PluginContext` injection — the shell populates `ctx.moduleStatus: { id, name, status }[]` after `core.init()`.

### 5.5 Dashboard PO

```ts
export class DashboardPage {
	constructor(private readonly root: HTMLElement) {}
	get title(): string { ... }
	get moduleCards(): { name: string; status: string }[] { ... }
	get navLinks(): string[] { ... }
}
```

## 6. Refactoring Existing Pages

### 6.1 Pages to update

| Page/Component | Changes |
|---------------|---------|
| `Home.vue` | Add `data-testid` to greeting, version, nav link. Create `Home.po.ts`. |
| `About.vue` | Add `data-testid` to title, version. Create `About.po.ts`. |
| `HelloCard.vue` | Add `data-testid` to title, message. Create `HelloCard.po.ts`. |
| `EventInspectorView.vue` | Add `data-testid` to filter, event list, items. Create `EventInspector.po.ts`. |
| `FileDetailView.vue` | Add `data-testid` to summary fields. Create `FileDetail.po.ts`. |

### 6.2 Test rewriting

All existing page/component tests rewritten to use POs:
- Replace `wrapper.text().toContain(...)` with `page.greeting`
- Replace `wrapper.html().toMatch(...)` with PO semantic accessors
- Replace raw `querySelector` calls with PO methods

## 7. Storybook Stories

### 7.1 Layout stories

```
stories/layouts/MainLayout.stories.ts
stories/layouts/PanelLayout.stories.ts
stories/layouts/DashboardLayout.stories.ts
```

Each story renders the layout with placeholder content showing the slot structure.

### 7.2 Updated page stories

Every page story gains at least one `play` function using the page's PO.

### 7.3 Story organization

```
stories/
├── layouts/
│   ├── MainLayout.stories.ts
│   ├── PanelLayout.stories.ts
│   └── DashboardLayout.stories.ts
├── pages/
│   ├── Home.stories.ts
│   ├── About.stories.ts
│   └── Dashboard.stories.ts
├── components/
│   └── HelloCard.stories.ts
└── (existing HelloCard.stories.ts moved to components/)
```

## 8. File Inventory

### New files

```
src/ui/layouts/MainLayout.vue
src/ui/layouts/PanelLayout.vue
src/ui/layouts/DashboardLayout.vue
src/ui/pages/Dashboard.vue
src/ui/pages/Home.po.ts
src/ui/pages/About.po.ts
src/ui/pages/Dashboard.po.ts
src/ui/components/HelloCard.po.ts
src/ui/stores/module-status-store.ts
styles/layouts.css
stories/layouts/MainLayout.stories.ts
stories/layouts/PanelLayout.stories.ts
stories/layouts/DashboardLayout.stories.ts
stories/pages/Home.stories.ts
stories/pages/About.stories.ts
stories/pages/Dashboard.stories.ts
stories/components/HelloCard.stories.ts
tests/ui/pages/Dashboard.test.ts
tests/ui/stores/module-status-store.test.ts
```

### Modified files

```
src/ui/AppRoot.vue                    # dynamic layout resolution
src/ui/router/index.ts                # add dashboard route, meta on all routes
src/ui/pages/Home.vue                 # add data-testid attributes
src/ui/pages/About.vue                # add data-testid attributes
src/ui/components/HelloCard.vue       # add data-testid attributes
src/ui/app.ts                         # pass module status to context
src/plugin.ts                         # PluginContext gains moduleStatus
tests/ui/pages/Home.test.ts           # rewrite with PO
tests/ui/components/HelloCard.test.ts # rewrite with PO
stories/HelloCard.stories.ts          # move to stories/components/, update with PO
```

## 9. Acceptance Criteria

1. `AppRoot.vue` resolves layout from `route.meta.layout` — routes without meta default to `MainLayout`.
2. Three layout components render correctly (verified by Storybook stories).
3. Every page and interactive component has a `.po.ts` file.
4. POs query only via `data-testid` — no class/tag/text queries in tests.
5. Storybook `play` functions use POs — at least one interaction story per page.
6. Vitest tests use the same POs — no raw DOM queries in page/component tests.
7. Dashboard page renders inside `DashboardLayout` with module status cards.
8. `npm test` green, coverage >= 80/70/80/80.
9. `npm run storybook` shows all layouts + pages with working interactions.

## 10. Risks

- **Layout CSS conflicts with Obsidian** — mitigated by `agentonomous-layout--*` prefix on all classes.
- **`data-testid` stripped in production** — NOT stripped. Obsidian plugins ship un-minified `main.js`; testids remain in the DOM. If stripping is needed later, a Vite plugin can remove them for release builds.
- **`DashboardLayout` named-slot complexity** — pages that don't fill a named slot get an empty area. Layouts should hide empty slot areas via `:has()` or `v-if="$slots.sidebar"`.

## 11. Next Step

After this spec is approved, the `writing-plans` skill produces the implementation plan.
