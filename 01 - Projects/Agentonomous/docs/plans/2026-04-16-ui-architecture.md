# UI Architecture — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add layout system (Main/Panel/Dashboard), PageObject pattern (.po.ts shared by Storybook + Vitest), data-testid convention, Dashboard page with module status cards, and refactor all existing pages/tests.

**Architecture:** Layouts are Vue components resolved via `route.meta.layout` in `AppRoot.vue`. Sidebar views use `PanelLayout` directly (no router). PageObjects are plain classes querying `data-testid` attributes, instantiated with an HTMLElement root. Stories and tests share the same POs.

**Tech Stack:** Vue 3, Vue Router 4, Pinia 2, Vitest 4, Storybook 10.

**Spec:** [`docs/specs/2026-04-16-ui-architecture-design.md`](../specs/2026-04-16-ui-architecture-design.md)

**Conventions:** Same as prior increments. TDD. Tabs. `.js` imports. `data-testid` in kebab-case.

---

## Chunk 1: Layouts + PageObjects + Dashboard + Stories

### Task 1: Three layout components + CSS

**Files:**
- Create: `src/ui/layouts/MainLayout.vue`
- Create: `src/ui/layouts/PanelLayout.vue`
- Create: `src/ui/layouts/DashboardLayout.vue`
- Create: `styles/layouts.css`

- [ ] **Step 1: Create `MainLayout.vue`**

```vue
<script setup lang="ts">
</script>

<template>
	<div class="agentonomous-layout agentonomous-layout--main">
		<header v-if="$slots.header" class="layout-header" data-testid="layout-header">
			<slot name="header" />
		</header>
		<main class="layout-content" data-testid="layout-content">
			<slot />
		</main>
	</div>
</template>
```

- [ ] **Step 2: Create `PanelLayout.vue`**

```vue
<script setup lang="ts">
</script>

<template>
	<div class="agentonomous-layout agentonomous-layout--panel">
		<header v-if="$slots.header" class="panel-header" data-testid="panel-header">
			<slot name="header" />
		</header>
		<div class="panel-content" data-testid="panel-content">
			<slot />
		</div>
	</div>
</template>
```

- [ ] **Step 3: Create `DashboardLayout.vue`**

```vue
<script setup lang="ts">
</script>

<template>
	<div class="agentonomous-layout agentonomous-layout--dashboard">
		<header v-if="$slots.header" class="dashboard-header" data-testid="dashboard-header">
			<slot name="header" />
		</header>
		<aside v-if="$slots.sidebar" class="dashboard-sidebar" data-testid="dashboard-sidebar">
			<slot name="sidebar" />
		</aside>
		<main class="dashboard-main" data-testid="dashboard-main">
			<slot />
		</main>
	</div>
</template>
```

Note: `v-if="$slots.sidebar"` hides the aside when the page doesn't fill the slot — prevents empty grid areas.

- [ ] **Step 4: Create `styles/layouts.css`**

```css
.agentonomous-layout {
	height: 100%;
	color: var(--text-normal);
}

.agentonomous-layout--main {
	display: flex;
	flex-direction: column;
	padding: 1rem;
}

.agentonomous-layout--main .layout-header {
	margin-bottom: 1rem;
}

.agentonomous-layout--panel {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.agentonomous-layout--panel .panel-header {
	padding: 0.75rem 1rem;
	border-bottom: 1px solid var(--background-modifier-border);
	font-weight: 600;
}

.agentonomous-layout--panel .panel-content {
	flex: 1;
	overflow-y: auto;
	padding: 0.75rem 1rem;
}

.agentonomous-layout--dashboard {
	display: grid;
	grid-template-columns: 200px 1fr;
	grid-template-rows: auto 1fr;
	grid-template-areas:
		"header header"
		"sidebar main";
	height: 100%;
}

.agentonomous-layout--dashboard .dashboard-header {
	grid-area: header;
	padding: 1rem;
	border-bottom: 1px solid var(--background-modifier-border);
}

.agentonomous-layout--dashboard .dashboard-sidebar {
	grid-area: sidebar;
	padding: 1rem;
	border-right: 1px solid var(--background-modifier-border);
	overflow-y: auto;
}

.agentonomous-layout--dashboard .dashboard-main {
	grid-area: main;
	padding: 1rem;
	overflow-y: auto;
}
```

- [ ] **Step 5: Commit**: `feat(agentonomous): add three layout components + CSS`

### Task 2: Refactor `AppRoot.vue` for dynamic layout resolution

**Files:**
- Modify: `src/ui/AppRoot.vue`
- Modify: `src/ui/router/index.ts` — add `meta: { layout }` to routes

- [ ] **Step 1: Update `AppRoot.vue`**

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
	const name = (route.meta?.layout as LayoutName | undefined) ?? 'main';
	return layouts[name] ?? MainLayout;
});
</script>

<template>
	<component :is="LayoutComponent">
		<router-view />
	</component>
</template>
```

- [ ] **Step 2: Add `meta` to existing routes in `router/index.ts`**

```ts
routes: [
	{ path: '/', name: 'home', component: Home, meta: { layout: 'main' } },
	{ path: '/about', name: 'about', component: About, meta: { layout: 'main' } },
],
```

- [ ] **Step 3: Run `npm test` — existing tests must pass**

The `AppRoot.vue` change wraps `<router-view>` in a layout. Existing tests that mount `Home.vue` or `About.vue` directly (not through `AppRoot`) are unaffected. Tests that use the router should still work — the default fallback is `MainLayout`, which just adds a wrapping div.

- [ ] **Step 4: Commit**: `refactor(agentonomous): AppRoot resolves layout from route.meta`

### Task 3: Sidebar views use PanelLayout directly

**Files:**
- Modify: `src/modules/event-inspector/views/EventInspectorView.vue` — wrap content in `PanelLayout`
- Modify: `src/modules/file-detail/views/FileDetailView.vue` — wrap content in `PanelLayout`

- [ ] **Step 1: Update EventInspectorView.vue**

Wrap the existing template content in `<PanelLayout>`:
```vue
<script setup lang="ts">
import PanelLayout from '../../../ui/layouts/PanelLayout.vue';
// ... existing imports ...
</script>

<template>
	<PanelLayout>
		<template #header>Event Inspector</template>
		<!-- existing content goes in the default slot -->
	</PanelLayout>
</template>
```

- [ ] **Step 2: Update FileDetailView.vue** — same pattern with `PanelLayout`.

- [ ] **Step 3: Run `npm test`**

- [ ] **Step 4: Commit**: `refactor(agentonomous): sidebar views use PanelLayout directly`

### Task 4: `data-testid` on existing pages + components

**Files:**
- Modify: `src/ui/pages/Home.vue`
- Modify: `src/ui/pages/About.vue`
- Modify: `src/ui/components/HelloCard.vue`

- [ ] **Step 1: Add testids to `Home.vue`**

```vue
<template>
	<div class="agentonomous-home">
		<HelloCard data-testid="greeting" :title="greeting" :message="`Version ${pluginVersion}`" />
		<p data-testid="version">{{ pluginVersion }}</p>
		<nav class="agentonomous-nav">
			<router-link data-testid="nav-about" to="/about">About</router-link>
		</nav>
	</div>
</template>
```

- [ ] **Step 2: Add testids to `About.vue`**

```vue
<template>
	<div class="agentonomous-about">
		<h2 data-testid="about-title">Agentonomous</h2>
		<p data-testid="about-version">... version {{ pluginVersion }} ...</p>
		<nav class="agentonomous-nav">
			<router-link data-testid="nav-home" to="/">Home</router-link>
		</nav>
	</div>
</template>
```

- [ ] **Step 3: Add testids to `HelloCard.vue`**

```vue
<template>
	<section class="hello-card">
		<h2 class="hello-card__title" data-testid="card-title">{{ title }}</h2>
		<p class="hello-card__message" data-testid="card-message">{{ message }}</p>
	</section>
</template>
```

- [ ] **Step 4: Run `npm test` — existing tests may break if they assert on exact HTML structure. Fix as needed.**

- [ ] **Step 5: Commit**: `feat(agentonomous): add data-testid attributes to pages + components`

### Task 5: PageObject files

**Files:**
- Create: `src/ui/pages/Home.po.ts`
- Create: `src/ui/pages/About.po.ts`
- Create: `src/ui/components/HelloCard.po.ts`

- [ ] **Step 1: Create `Home.po.ts`**

```ts
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

- [ ] **Step 2: Create `About.po.ts`**

```ts
export class AboutPage {
	constructor(private readonly root: HTMLElement) {}

	get title(): string {
		return this.el('about-title')?.textContent?.trim() ?? '';
	}

	get version(): string {
		return this.el('about-version')?.textContent?.trim() ?? '';
	}

	get homeLink(): HTMLElement | null {
		return this.el('nav-home');
	}

	async navigateToHome(): Promise<void> {
		this.homeLink?.click();
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
```

- [ ] **Step 3: Create `HelloCard.po.ts`**

```ts
export class HelloCardPO {
	constructor(private readonly root: HTMLElement) {}

	get title(): string {
		return this.el('card-title')?.textContent?.trim() ?? '';
	}

	get message(): string {
		return this.el('card-message')?.textContent?.trim() ?? '';
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
```

- [ ] **Step 4: Commit**: `feat(agentonomous): add PageObject files for Home, About, HelloCard`

### Task 6: Rewrite existing tests to use POs

**Files:**
- Modify: `tests/ui/pages/Home.test.ts`
- Modify: `tests/ui/pages/About.test.ts` (if exists)
- Modify: `tests/ui/components/HelloCard.test.ts`

- [ ] **Step 1: Rewrite `Home.test.ts`**

Replace raw `wrapper.text()` / `wrapper.html()` assertions with PO:

```ts
import { HomePage } from '../../../src/ui/pages/Home.po.js';

it('renders greeting from store', async () => {
	// ... existing mount + router setup ...
	const page = new HomePage(wrapper.element as HTMLElement);
	expect(page.greeting).toContain('Hello from Agentonomous');
	expect(page.version).toMatch(/\d/);
});

it('has a link to /about', () => {
	// ... mount ...
	const page = new HomePage(wrapper.element as HTMLElement);
	expect(page.aboutLink).not.toBeNull();
});
```

- [ ] **Step 2: Rewrite `HelloCard.test.ts`**

```ts
import { HelloCardPO } from '../../../src/ui/components/HelloCard.po.js';

it('renders title and message props', () => {
	const wrapper = mount(HelloCard, { props: { title: 'Hi', message: 'Welcome' } });
	const po = new HelloCardPO(wrapper.element as HTMLElement);
	expect(po.title).toBe('Hi');
	expect(po.message).toBe('Welcome');
});
```

- [ ] **Step 3: Update `About.test.ts`** similarly with `AboutPage` PO.

- [ ] **Step 4: Run `npm test` — all must pass with the PO-based assertions**

- [ ] **Step 5: Commit**: `refactor(agentonomous): rewrite page + component tests to use PageObjects`

### Task 7: Storybook `withRouter` decorator + reorganize stories

**Files:**
- Create: `stories/decorators/with-router.ts`
- Move: `stories/HelloCard.stories.ts` → `stories/components/HelloCard.stories.ts`
- Create: `stories/layouts/MainLayout.stories.ts`
- Create: `stories/layouts/PanelLayout.stories.ts`
- Create: `stories/layouts/DashboardLayout.stories.ts`
- Create: `stories/pages/Home.stories.ts`
- Create: `stories/pages/About.stories.ts`

- [ ] **Step 1: Create `withRouter` decorator**

```ts
// stories/decorators/with-router.ts
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Decorator } from '@storybook/vue3-vite';

export const withRouter: Decorator = (story, context) => {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', component: { template: '<div>Home stub</div>' } },
			{ path: '/about', component: { template: '<div>About stub</div>' } },
			{ path: '/dashboard', component: { template: '<div>Dashboard stub</div>' } },
		],
	});

	return {
		setup() {
			return {};
		},
		template: '<story />',
		global: { plugins: [router] },
	};
};
```

Note: The exact Storybook decorator API may vary. If `Decorator` from `@storybook/vue3-vite` doesn't exist, use the render function pattern instead. The implementer should verify the correct Storybook 10 decorator API.

- [ ] **Step 2: Create layout stories**

Each layout story renders the layout with placeholder slot content:

```ts
// stories/layouts/DashboardLayout.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import DashboardLayout from '../../src/ui/layouts/DashboardLayout.vue';

const meta: Meta<typeof DashboardLayout> = {
	title: 'Layouts/DashboardLayout',
	component: DashboardLayout,
};
export default meta;

type Story = StoryObj<typeof DashboardLayout>;

export const Default: Story = {
	render: () => ({
		components: { DashboardLayout },
		template: `
			<DashboardLayout>
				<template #header><h2>Dashboard Header</h2></template>
				<template #sidebar><nav>Sidebar Nav</nav></template>
				<div>Main Content Area</div>
			</DashboardLayout>
		`,
	}),
};
```

Similar for `MainLayout` and `PanelLayout`.

- [ ] **Step 3: Create page stories with POs in `play`**

```ts
// stories/pages/Home.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Home from '../../src/ui/pages/Home.vue';
import { HomePage } from '../../src/ui/pages/Home.po.js';
import { expect } from 'vitest';
import { withRouter } from '../decorators/with-router.js';

const meta: Meta<typeof Home> = {
	title: 'Pages/Home',
	component: Home,
	decorators: [withRouter],
};
export default meta;

type Story = StoryObj<typeof Home>;

export const Default: Story = {};

export const RendersGreeting: Story = {
	play: async ({ canvasElement }) => {
		const page = new HomePage(canvasElement);
		expect(page.greeting).toContain('Agentonomous');
	},
};
```

Note: Stories for pages that use Pinia stores need the store to be initialized. The `withRouter` decorator handles routing; Pinia may need a separate decorator or setup in the story's `render` function. The implementer should check if Storybook's preview already installs Pinia (from Increment 1's `preview.ts`).

- [ ] **Step 4: Move `stories/HelloCard.stories.ts` → `stories/components/HelloCard.stories.ts`**

Update the story to use `HelloCardPO`:

```ts
import { HelloCardPO } from '../../src/ui/components/HelloCard.po.js';

export const RendersContent: Story = {
	args: { title: 'Test', message: 'Hello' },
	play: async ({ canvasElement }) => {
		const po = new HelloCardPO(canvasElement);
		expect(po.title).toBe('Test');
		expect(po.message).toBe('Hello');
	},
};
```

- [ ] **Step 5: Run `npm run storybook` — verify all stories render. Run `npm run build-storybook` to verify compilation.**

- [ ] **Step 6: Commit**: `feat(agentonomous): add withRouter decorator + layout + page stories with POs`

### Task 8: Dashboard page + module status store

**Files:**
- Create: `src/ui/pages/Dashboard.vue`
- Create: `src/ui/pages/Dashboard.po.ts`
- Create: `src/ui/stores/module-status-store.ts`
- Create: `tests/ui/pages/Dashboard.test.ts`
- Create: `tests/ui/stores/module-status-store.test.ts`
- Create: `stories/pages/Dashboard.stories.ts`
- Modify: `src/ui/router/index.ts` — add `/dashboard` route
- Modify: `src/plugin.ts` — add `moduleStatus` to `PluginContext`
- Modify: `src/core/plugin-core.ts` — add public `modules` getter

- [ ] **Step 1: Add `moduleStatus` type and field to `PluginContext`**

In `src/plugin.ts`:
```ts
export type ModuleStatus = {
	readonly id: string;
	readonly name: string;
	readonly status: 'ready' | 'degraded' | 'not-loaded';
};

// Add to PluginContext:
readonly moduleStatus: readonly ModuleStatus[];
```

In `src/core/plugin-core.ts`, add a public getter:
```ts
get modules(): readonly Module[] {
	return this.sortedModules ?? [];
}
```

(Where `sortedModules` is the topo-sorted array stored during `init()`.)

In `src/main.ts`, after `core.init()`:
```ts
const moduleStatus: ModuleStatus[] = core.modules.map((m) => ({
	id: m.id,
	name: m.name,
	status: core.degradedModules.includes(m.id) ? 'degraded' as const : 'ready' as const,
}));
```

Pass `moduleStatus` into the `PluginContext`.

- [ ] **Step 2: Create `useModuleStatusStore`**

```ts
// src/ui/stores/module-status-store.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ModuleStatus } from '../../plugin.js';

export const useModuleStatusStore = defineStore('module-status', () => {
	const modules = ref<readonly ModuleStatus[]>([]);

	function setModules(list: readonly ModuleStatus[]): void {
		modules.value = list;
	}

	return { modules, setModules };
});
```

In `src/ui/app.ts`, hydrate the store:
```ts
const statusStore = useModuleStatusStore(pinia);
statusStore.setModules(ctx.moduleStatus);
```

Test:
```ts
// tests/ui/stores/module-status-store.test.ts
import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useModuleStatusStore } from '../../../src/ui/stores/module-status-store.js';

describe('useModuleStatusStore', () => {
	it('setModules() populates the modules list', () => {
		setActivePinia(createPinia());
		const store = useModuleStatusStore();
		store.setModules([
			{ id: 'core', name: 'Core', status: 'ready' },
			{ id: 'broken', name: 'Broken', status: 'degraded' },
		]);
		expect(store.modules).toHaveLength(2);
		expect(store.modules[0].status).toBe('ready');
	});
});
```

- [ ] **Step 3: Create `Dashboard.vue`**

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app-store.js';
import { useModuleStatusStore } from '../stores/module-status-store.js';

const appStore = useAppStore();
const { pluginVersion } = storeToRefs(appStore);
const statusStore = useModuleStatusStore();
const { modules } = storeToRefs(statusStore);
</script>

<template>
	<template #header>
		<h1 data-testid="dashboard-title">Agentonomous</h1>
		<span data-testid="dashboard-version">v{{ pluginVersion }}</span>
	</template>
	<template #sidebar>
		<nav>
			<router-link data-testid="nav-home" to="/">Home</router-link>
			<router-link data-testid="nav-dashboard" to="/dashboard">Dashboard</router-link>
			<router-link data-testid="nav-about" to="/about">About</router-link>
		</nav>
	</template>
	<div class="dashboard-cards" data-testid="module-cards">
		<div
			v-for="mod in modules"
			:key="mod.id"
			class="module-card"
			:data-testid="`module-card-${mod.id}`"
		>
			<span class="module-card__name" data-testid="module-name">{{ mod.name }}</span>
			<span
				class="module-card__status"
				data-testid="module-status"
				:class="{
					'module-card__status--ready': mod.status === 'ready',
					'module-card__status--degraded': mod.status === 'degraded',
				}"
			>{{ mod.status }}</span>
		</div>
	</div>
</template>
```

Note: The named slots (`#header`, `#sidebar`) are filled by the page — `DashboardLayout` renders them. The page template uses `<template #header>` directly because `AppRoot.vue` wraps `<router-view />` in the resolved layout. Verify this works: the layout's `<slot name="header" />` should receive the page's `<template #header>` content.

**Important Vue 3 caveat:** Named slots from a `<router-view>` child into its parent layout wrapper require Vue Router 4.1+ with the `<router-view v-slot>` pattern. The `AppRoot.vue` implementation may need:

```vue
<component :is="LayoutComponent">
	<router-view v-slot="{ Component }">
		<component :is="Component" />
	</router-view>
</component>
```

Actually, this won't forward named slots from the page to the layout. The standard pattern for page-level named slots in layouts is:

**Option A:** Pages don't fill named slots. Layouts provide their own header/sidebar content (or leave it to the page's default slot).

**Option B:** Pages render the layout themselves:
```vue
<!-- Dashboard.vue -->
<template>
	<div class="dashboard-cards" data-testid="module-cards">
		<!-- Just the main content. Header + sidebar are part of the layout, not the page. -->
	</div>
</template>
```

And the `DashboardLayout` has its own hardcoded header/sidebar (or reads from stores/routes).

Go with **Option B** for simplicity — the layout owns its own chrome; pages only fill the default slot. The Dashboard page just renders module cards. The `DashboardLayout` reads the plugin name, version, and nav links from stores or props. This avoids the named-slot-through-router-view problem entirely.

Revise `Dashboard.vue` to only render main content:

```vue
<template>
	<div class="dashboard-cards" data-testid="module-cards">
		<div
			v-for="mod in modules"
			:key="mod.id"
			class="module-card"
			:data-testid="`module-card-${mod.id}`"
		>
			<span data-testid="module-name">{{ mod.name }}</span>
			<span data-testid="module-status">{{ mod.status }}</span>
		</div>
	</div>
</template>
```

And `DashboardLayout.vue` reads its header/sidebar content from stores:

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app-store.js';

const { pluginVersion } = storeToRefs(useAppStore());
</script>

<template>
	<div class="agentonomous-layout agentonomous-layout--dashboard">
		<header class="dashboard-header" data-testid="dashboard-header">
			<h1>Agentonomous</h1>
			<span data-testid="dashboard-version">v{{ pluginVersion }}</span>
		</header>
		<aside class="dashboard-sidebar" data-testid="dashboard-sidebar">
			<nav>
				<router-link data-testid="nav-home" to="/">Home</router-link>
				<router-link data-testid="nav-dashboard" to="/dashboard">Dashboard</router-link>
				<router-link data-testid="nav-about" to="/about">About</router-link>
			</nav>
		</aside>
		<main class="dashboard-main" data-testid="dashboard-main">
			<slot />
		</main>
	</div>
</template>
```

This means `DashboardLayout` is opinionated (owns its header + nav). Fine for a skeleton — if a second dashboard-style page needs different chrome, extract at that point.

- [ ] **Step 4: Create `Dashboard.po.ts`**

```ts
export class DashboardPage {
	constructor(private readonly root: HTMLElement) {}

	get moduleCards(): { name: string; status: string }[] {
		const cards = this.root.querySelectorAll('[data-testid^="module-card-"]');
		return Array.from(cards).map((card) => ({
			name: card.querySelector('[data-testid="module-name"]')?.textContent?.trim() ?? '',
			status: card.querySelector('[data-testid="module-status"]')?.textContent?.trim() ?? '',
		}));
	}

	private el(testId: string): HTMLElement | null {
		return this.root.querySelector(`[data-testid="${testId}"]`);
	}
}
```

- [ ] **Step 5: Add `/dashboard` route**

In `src/ui/router/index.ts`:
```ts
import Dashboard from '../pages/Dashboard.vue';

// Add to routes:
{ path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { layout: 'dashboard' } },
```

- [ ] **Step 6: Write Dashboard test**

```ts
// tests/ui/pages/Dashboard.test.ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import Dashboard from '../../../src/ui/pages/Dashboard.vue';
import { DashboardPage } from '../../../src/ui/pages/Dashboard.po.js';
import { useModuleStatusStore } from '../../../src/ui/stores/module-status-store.js';

describe('Dashboard page', () => {
	it('renders module status cards', async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const store = useModuleStatusStore();
		store.setModules([
			{ id: 'core', name: 'Core', status: 'ready' },
			{ id: 'event-inspector', name: 'Event Inspector', status: 'ready' },
			{ id: 'broken', name: 'Broken', status: 'degraded' },
		]);

		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: '/dashboard', component: Dashboard }],
		});
		router.push('/dashboard');
		await router.isReady();

		const wrapper = mount(Dashboard, { global: { plugins: [pinia, router] } });
		const page = new DashboardPage(wrapper.element as HTMLElement);
		expect(page.moduleCards).toHaveLength(3);
		expect(page.moduleCards[0].name).toBe('Core');
		expect(page.moduleCards[2].status).toBe('degraded');
	});
});
```

- [ ] **Step 7: Create Dashboard story**

```ts
// stories/pages/Dashboard.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Dashboard from '../../src/ui/pages/Dashboard.vue';
import { DashboardPage } from '../../src/ui/pages/Dashboard.po.js';
import { expect } from 'vitest';
import { withRouter } from '../decorators/with-router.js';

const meta: Meta<typeof Dashboard> = {
	title: 'Pages/Dashboard',
	component: Dashboard,
	decorators: [withRouter],
};
export default meta;

type Story = StoryObj<typeof Dashboard>;

export const WithModules: Story = {
	play: async ({ canvasElement }) => {
		const page = new DashboardPage(canvasElement);
		// Module cards may be empty in Storybook (no PluginCore)
		// The structural test is that the component renders without error
		expect(canvasElement.querySelector('[data-testid="module-cards"]')).not.toBeNull();
	},
};
```

- [ ] **Step 8: Commit**: `feat(agentonomous): add Dashboard page + module status store + PO`

### Task 9: Final quality gate

- [ ] **Step 1: Run full suite with coverage**

```bash
npx vitest run --config configs/vitest.config.ts --coverage
```

Expected: ~270+ tests, coverage >= 80/70/80/80.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

- [ ] **Step 4: Storybook build**

```bash
npm run build-storybook
```

- [ ] **Step 5: Full `npm test`**

Expected: exit 0.

- [ ] **Step 6: Commit any final adjustments**

---

## Done

Increment 5 ships:
- Three layout components (Main, Panel, Dashboard) with CSS grid
- Dynamic layout resolution via `route.meta.layout` in AppRoot
- Sidebar views use PanelLayout directly
- PageObject pattern: `.po.ts` co-located with pages/components
- `data-testid` convention on all interactive/assertable elements
- All page/component tests rewritten to use POs
- Storybook `withRouter` decorator for stories with router-links
- Layout stories + page stories with PO `play` functions
- Dashboard page with module status cards via `useModuleStatusStore`
- Story reorganization (layouts/, pages/, components/)

Spec acceptance criteria 1-9 satisfied.
