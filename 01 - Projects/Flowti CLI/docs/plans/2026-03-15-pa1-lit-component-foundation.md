# PA1: Lit Component Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Lit Web Components as the Plugin's frontend framework with design tokens, a base component class, test utilities, and a storybook runner — all working in isolation without CLI dependency.

**Architecture:** Portable Lit components live in `src/components/`, receive data via properties, emit DOM events. They render in any browser context (Obsidian, storybook, happy-dom tests). An Obsidian CSS adapter maps theme variables to Flowti design tokens. A simple storybook runner loads components with story data in a standalone HTML page.

**Tech Stack:** Lit 3.x, esbuild (existing), happy-dom (existing), vitest (existing)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-plugin-cli-integration-design.md` — Section 5

**All paths relative to:** `Development/flowti/`

---

## Chunk 1: Setup & Design Tokens

### Task 1: Install Lit and verify build

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install Lit**

```bash
cd "Development/flowti" && npm install lit
```

This adds `lit` as a runtime dependency (it ships in the Plugin bundle).

- [ ] **Step 2: Verify TypeScript can resolve Lit imports**

Create a throwaway test — add this temporarily to verify compilation:

```bash
cd "Development/flowti" && echo "import { LitElement } from 'lit'; console.log(LitElement);" > src/lit-check.ts && npx tsc --noEmit && rm src/lit-check.ts
```

Expected: No TypeScript errors. If Lit's types resolve, the import works.

- [ ] **Step 3: Verify esbuild bundles Lit**

```bash
cd "Development/flowti" && node esbuild.config.mjs --no-reports 2>&1 | head -5
```

Expected: Build succeeds. esbuild bundles Lit's ESM into the Plugin's CJS output.

- [ ] **Step 4: Verify existing tests still pass**

```bash
cd "Development/flowti" && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: All 7,697 tests pass. Lit installation has zero impact on existing code.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/package.json" "Development/flowti/package-lock.json" && git commit -m "feat(plugin): add lit as runtime dependency"
```

---

### Task 2: Create Flowti design tokens

**Files:**
- Create: `src/components/tokens.ts`
- Create: `css/00-tokens.css`

Design tokens define the visual language. Components use `var(--flowti-*)` internally. In Obsidian, an adapter maps Obsidian's CSS variables to these tokens. In storybook, default values apply.

- [ ] **Step 1: Create the tokens CSS file**

This file sits in the `css/` folder and gets concatenated into `styles.css` by the existing build. It defines Flowti tokens with sensible defaults and maps them from Obsidian variables when available.

Create `css/00-tokens.css`:

```css
/* Flowti Design Tokens
 * Portable token layer — components use var(--flowti-*) only.
 * In Obsidian: tokens inherit from Obsidian CSS variables.
 * In storybook: fallback defaults apply.
 */

:root {
	/* Colors — mapped from Obsidian theme */
	--flowti-bg-primary: var(--background-primary, #1e1e2e);
	--flowti-bg-secondary: var(--background-secondary, #181825);
	--flowti-bg-hover: var(--background-modifier-hover, #313244);
	--flowti-border: var(--background-modifier-border, #45475a);
	--flowti-accent: var(--interactive-accent, #89b4fa);
	--flowti-accent-hover: var(--interactive-accent-hover, #74c7ec);

	/* Text */
	--flowti-text: var(--text-normal, #cdd6f4);
	--flowti-text-muted: var(--text-muted, #a6adc8);
	--flowti-text-on-accent: var(--text-on-accent, #1e1e2e);

	/* Typography */
	--flowti-font: var(--font-interface, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
	--flowti-font-sm: var(--font-ui-small, 0.875rem);
	--flowti-font-xs: var(--font-ui-smaller, 0.75rem);

	/* Spacing */
	--flowti-space-xs: 0.25rem;
	--flowti-space-sm: 0.5rem;
	--flowti-space-md: 0.75rem;
	--flowti-space-lg: 1rem;
	--flowti-space-xl: 1.5rem;

	/* Radius */
	--flowti-radius-sm: var(--radius-s, 4px);
	--flowti-radius-md: var(--radius-m, 8px);

	/* Status colors */
	--flowti-success: #a6e3a1;
	--flowti-warning: #f9e2af;
	--flowti-error: #f38ba8;
	--flowti-info: #89b4fa;
}
```

- [ ] **Step 2: Create the Lit-consumable token module**

Lit components import this to get shared styles inside Shadow DOM:

Create `src/components/tokens.ts`:

```typescript
import { css } from 'lit';

/**
 * Shared design tokens for all Flowti Lit components.
 * Import into any component's `static styles` array.
 * Tokens use CSS custom properties — values come from :root (Obsidian or storybook).
 */
export const tokens = css`
	:host {
		font-family: var(--flowti-font);
		color: var(--flowti-text);
	}
`;

/**
 * Common utility styles shared across components.
 */
export const utilities = css`
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
```

- [ ] **Step 3: Verify build includes new CSS**

```bash
cd "Development/flowti" && node esbuild.config.mjs --no-reports 2>&1 | head -5
```

Expected: Build succeeds. The `00-tokens.css` file gets concatenated into `styles.css` (alphabetically sorted among `00-*` files, after `00-base.css`).

- [ ] **Step 4: Verify tokens appear in built styles.css**

```bash
cd "Development/flowti" && grep "flowti-bg-primary" .obsidian/plugins/flowti-ibde/styles.css | head -1
```

Expected: Line containing `--flowti-bg-primary` found in output.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/css/00-tokens.css" "Development/flowti/src/components/tokens.ts" && git commit -m "feat(plugin): add Flowti design tokens for Lit components"
```

---

## Chunk 2: Base Component Class & Test Utilities

### Task 3: Create component test utilities

**Files:**
- Create: `tests/components/test-utils.ts`

Test utilities must exist before the base class so we can TDD it.

- [ ] **Step 1: Create the component test helper module**

Create `tests/components/test-utils.ts`:

```typescript
/**
 * Test utilities for Lit components in happy-dom.
 *
 * Usage:
 *   const el = await fixture<MyElement>('my-element', { prop: 'value' });
 *   expect(el.shadowRoot?.textContent).toContain('value');
 *   cleanup();
 */

/**
 * Create and mount a Lit component, wait for first render.
 */
export async function fixture<T extends HTMLElement>(
	tag: string,
	props?: Record<string, unknown>,
): Promise<T> {
	const el = document.createElement(tag) as T;
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			(el as Record<string, unknown>)[key] = value;
		}
	}
	document.body.appendChild(el);
	// Wait for Lit's updateComplete if available
	if ('updateComplete' in el) {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
	}
	return el;
}

/**
 * Remove all test fixtures from the DOM.
 */
export function cleanup(): void {
	document.body.innerHTML = '';
}

/**
 * Query inside a component's shadow root.
 */
export function shadowQuery<T extends Element>(
	el: HTMLElement,
	selector: string,
): T | null {
	return el.shadowRoot?.querySelector<T>(selector) ?? null;
}

/**
 * Query all inside a component's shadow root.
 */
export function shadowQueryAll<T extends Element>(
	el: HTMLElement,
	selector: string,
): T[] {
	return Array.from(el.shadowRoot?.querySelectorAll<T>(selector) ?? []);
}

/**
 * Get visible text content from a component's shadow root.
 */
export function shadowText(el: HTMLElement): string {
	return el.shadowRoot?.textContent?.trim() ?? '';
}

/**
 * Dispatch a custom event and return whether it was handled.
 */
export function dispatch(
	el: HTMLElement,
	eventName: string,
	detail?: unknown,
): boolean {
	return el.dispatchEvent(
		new CustomEvent(eventName, { detail, bubbles: true, composed: true }),
	);
}
```

- [ ] **Step 2: Commit test utilities**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/tests/components/test-utils.ts" && git commit -m "feat(plugin): add Lit component test utilities"
```

---

### Task 4: Create FlowtiElement base class (TDD)

**Files:**
- Create: `src/components/flowti-element.ts`
- Create: `tests/components/flowti-element.test.ts`

The base class extends `LitElement` with shared tokens and common patterns (loading state, error boundary, empty state).

- [ ] **Step 1: Write the failing tests**

Create `tests/components/flowti-element.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { fixture, cleanup, shadowText, shadowQuery } from './test-utils.js';

// Import triggers custom element registration
import '../../src/components/flowti-element.js';

describe('FlowtiElement', () => {
	afterEach(() => cleanup());

	it('is defined as a custom element', () => {
		expect(customElements.get('flowti-element')).toBeDefined();
	});

	it('renders default slot content', async () => {
		const el = await fixture('flowti-element');
		el.innerHTML = '<span>Hello</span>';
		expect(el.shadowRoot).toBeDefined();
	});

	it('shows loading state when loading property is true', async () => {
		const el = await fixture('flowti-element', { loading: true });
		const loader = shadowQuery(el, '.flowti-loading');
		expect(loader).not.toBeNull();
	});

	it('hides loading state when loading is false', async () => {
		const el = await fixture('flowti-element', { loading: false });
		const loader = shadowQuery(el, '.flowti-loading');
		expect(loader).toBeNull();
	});

	it('shows error state when error property is set', async () => {
		const el = await fixture('flowti-element', { error: 'Something broke' });
		const text = shadowText(el);
		expect(text).toContain('Something broke');
	});

	it('shows empty state when empty property is true and not loading', async () => {
		const el = await fixture('flowti-element', { empty: true, emptyMessage: 'No data' });
		const text = shadowText(el);
		expect(text).toContain('No data');
	});

	it('applies design tokens via shared styles', async () => {
		const el = await fixture('flowti-element');
		expect(el.shadowRoot?.adoptedStyleSheets?.length ?? 0).toBeGreaterThanOrEqual(0);
		// Verify the component has a shadow root with styles
		expect(el.shadowRoot).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "Development/flowti" && npx vitest run tests/components/flowti-element.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — module `../../src/components/flowti-element.js` not found.

- [ ] **Step 3: Implement FlowtiElement**

Create `src/components/flowti-element.ts`:

```typescript
import { LitElement, html, css, nothing } from 'lit';
import { tokens, utilities } from './tokens.js';

/**
 * Base class for all Flowti Lit components.
 *
 * Provides:
 * - Shared design tokens (via `tokens` CSS)
 * - Loading state (`loading` property → spinner overlay)
 * - Error state (`error` property → error message)
 * - Empty state (`empty` + `emptyMessage` properties → placeholder)
 *
 * Subclasses override `renderContent()` for their main content.
 */
export class FlowtiElement extends LitElement {
	static properties = {
		loading: { type: Boolean, reflect: true },
		error: { type: String },
		empty: { type: Boolean },
		emptyMessage: { type: String, attribute: 'empty-message' },
	};

	static styles = [
		tokens,
		utilities,
		css`
			:host {
				display: block;
			}

			.flowti-loading {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-lg);
				color: var(--flowti-text-muted);
			}

			.flowti-error {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius-sm);
				background: color-mix(in srgb, var(--flowti-error) 15%, transparent);
				color: var(--flowti-error);
				font-size: var(--flowti-font-sm);
			}

			.flowti-empty {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl);
				color: var(--flowti-text-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	loading = false;
	error = '';
	empty = false;
	emptyMessage = 'No data available';

	render() {
		if (this.error) {
			return html`<div class="flowti-error">${this.error}</div>`;
		}
		if (this.loading) {
			return html`<div class="flowti-loading">Loading…</div>`;
		}
		if (this.empty) {
			return html`<div class="flowti-empty">${this.emptyMessage}</div>`;
		}
		return this.renderContent();
	}

	/**
	 * Override in subclasses to provide main content.
	 * Only called when not loading, no error, and not empty.
	 */
	protected renderContent() {
		return html`<slot></slot>`;
	}
}

customElements.define('flowti-element', FlowtiElement);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "Development/flowti" && npx vitest run tests/components/flowti-element.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 5: Verify all existing tests still pass**

```bash
cd "Development/flowti" && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: All 7,697+ tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/components/flowti-element.ts" "Development/flowti/tests/components/flowti-element.test.ts" && git commit -m "feat(plugin): add FlowtiElement base class with loading/error/empty states"
```

---

### Task 5: Create first portable component — flowti-status-badge (TDD)

**Files:**
- Create: `src/components/flowti-status-badge.ts`
- Create: `tests/components/flowti-status-badge.test.ts`

A simple, self-contained component that displays a status with a colored indicator. This proves the full component pipeline works end-to-end.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/flowti-status-badge.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { fixture, cleanup, shadowQuery, shadowText } from './test-utils.js';

import '../../src/components/flowti-status-badge.js';

describe('flowti-status-badge', () => {
	afterEach(() => cleanup());

	it('is defined as a custom element', () => {
		expect(customElements.get('flowti-status-badge')).toBeDefined();
	});

	it('renders label text', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Healthy' });
		expect(shadowText(el)).toContain('Healthy');
	});

	it('renders with success variant', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Pass', variant: 'success' });
		const dot = shadowQuery(el, '.dot');
		expect(dot).not.toBeNull();
		expect(el.getAttribute('variant')).toBe('success');
	});

	it('renders with error variant', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Fail', variant: 'error' });
		expect(el.getAttribute('variant')).toBe('error');
	});

	it('renders with warning variant', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Warn', variant: 'warning' });
		expect(el.getAttribute('variant')).toBe('warning');
	});

	it('renders with info variant by default', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Info' });
		expect(el.getAttribute('variant')).toBe('info');
	});

	it('renders with neutral variant', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Draft', variant: 'neutral' });
		expect(el.getAttribute('variant')).toBe('neutral');
	});

	it('shows value when provided', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Score', value: '87%' });
		expect(shadowText(el)).toContain('87%');
	});

	it('omits value element when value is empty', async () => {
		const el = await fixture('flowti-status-badge', { label: 'Status' });
		const valueEl = shadowQuery(el, '.value');
		expect(valueEl).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "Development/flowti" && npx vitest run tests/components/flowti-status-badge.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement flowti-status-badge**

Create `src/components/flowti-status-badge.ts`:

```typescript
import { html, css, nothing } from 'lit';
import { FlowtiElement } from './flowti-element.js';

/**
 * A status badge with a colored dot indicator.
 *
 * @property label - Text label (required)
 * @property variant - Color variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
 * @property value - Optional value displayed after the label
 *
 * @example
 * <flowti-status-badge label="Health" variant="success" value="92%"></flowti-status-badge>
 */
export class FlowtiStatusBadge extends FlowtiElement {
	// Lit inherits FlowtiElement.properties automatically via prototype chain
	static properties = {
		label: { type: String },
		variant: { type: String, reflect: true },
		value: { type: String },
	};

	// Explicitly include parent styles (Lit does not auto-merge static styles)
	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-bg-secondary);
				font-size: var(--flowti-font-xs);
				line-height: 1;
			}

			.dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			:host([variant="success"]) .dot { background: var(--flowti-success); }
			:host([variant="warning"]) .dot { background: var(--flowti-warning); }
			:host([variant="error"]) .dot { background: var(--flowti-error); }
			:host([variant="info"]) .dot { background: var(--flowti-info); }
			:host([variant="neutral"]) .dot { background: var(--flowti-text-muted); }

			.label {
				color: var(--flowti-text);
			}

			.value {
				color: var(--flowti-text-muted);
				margin-left: var(--flowti-space-xs);
			}
		`,
	];

	label = '';
	variant = 'info';
	value = '';

	protected renderContent() {
		return html`
			<span class="dot"></span>
			<span class="label">${this.label}</span>
			${this.value ? html`<span class="value">${this.value}</span>` : nothing}
		`;
	}
}

customElements.define('flowti-status-badge', FlowtiStatusBadge);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "Development/flowti" && npx vitest run tests/components/flowti-status-badge.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/components/flowti-status-badge.ts" "Development/flowti/tests/components/flowti-status-badge.test.ts" && git commit -m "feat(plugin): add flowti-status-badge portable Lit component"
```

---

## Chunk 3: Storybook Runner & Integration

### Task 6: Create storybook story format and runner

**Files:**
- Create: `stories/status-badge.story.ts`
- Create: `stories/story-types.ts`
- Create: `stories/storybook.html`
- Create: `stories/storybook-runner.ts`
- Modify: `esbuild.config.mjs` (add storybook build target)

- [ ] **Step 1: Define the story type contract**

Create `stories/story-types.ts`:

```typescript
/**
 * A story variant for a single component.
 * Each variant provides a set of properties to render the component with.
 */
export interface StoryVariant {
	/** Human-readable variant name */
	name: string;
	/** Properties to set on the component */
	props: Record<string, unknown>;
}

/**
 * A story definition for a component.
 */
export interface StoryDef {
	/** Component tag name (e.g., 'flowti-status-badge') */
	tag: string;
	/** Human-readable component name */
	title: string;
	/** Story variants to display */
	variants: StoryVariant[];
}
```

- [ ] **Step 2: Create the first story**

Create `stories/status-badge.story.ts`:

```typescript
import type { StoryDef } from './story-types.js';

// Side-effect import registers the custom element
import '../src/components/flowti-status-badge.js';

export const story: StoryDef = {
	tag: 'flowti-status-badge',
	title: 'Status Badge',
	variants: [
		{ name: 'Success', props: { label: 'Healthy', variant: 'success', value: '92%' } },
		{ name: 'Warning', props: { label: 'At Risk', variant: 'warning', value: '61%' } },
		{ name: 'Error', props: { label: 'Failing', variant: 'error', value: '23%' } },
		{ name: 'Info', props: { label: 'Running', variant: 'info' } },
		{ name: 'Neutral', props: { label: 'Draft', variant: 'neutral' } },
		{ name: 'With Long Label', props: { label: 'Code Coverage (statements)', variant: 'success', value: '80.53%' } },
		{ name: 'Loading', props: { loading: true } },
		{ name: 'Error State', props: { error: 'Failed to load health data' } },
		{ name: 'Empty State', props: { empty: true, emptyMessage: 'No status available' } },
	],
};
```

- [ ] **Step 3: Create the storybook runner script**

This module renders all story variants for a given story definition:

Create `stories/storybook-runner.ts`:

```typescript
import type { StoryDef, StoryVariant } from './story-types.js';

/**
 * Render all variants of a story into a container element.
 */
export function renderStory(storyDef: StoryDef, container: HTMLElement): void {
	container.innerHTML = '';

	const header = document.createElement('h1');
	header.textContent = storyDef.title;
	header.style.cssText = 'font-family: var(--flowti-font, sans-serif); color: var(--flowti-text, #cdd6f4); margin: 0 0 1.5rem;';
	container.appendChild(header);

	const grid = document.createElement('div');
	grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 1.5rem;';
	container.appendChild(grid);

	for (const variant of storyDef.variants) {
		const card = renderVariant(storyDef.tag, variant);
		grid.appendChild(card);
	}
}

function renderVariant(tag: string, variant: StoryVariant): HTMLElement {
	const card = document.createElement('div');
	card.style.cssText = `
		padding: 1rem;
		border: 1px solid var(--flowti-border, #45475a);
		border-radius: var(--flowti-radius-md, 8px);
		background: var(--flowti-bg-secondary, #181825);
		min-width: 200px;
	`;

	const label = document.createElement('div');
	label.textContent = variant.name;
	label.style.cssText = `
		font-size: 0.75rem;
		color: var(--flowti-text-muted, #a6adc8);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	`;
	card.appendChild(label);

	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(variant.props)) {
		(el as Record<string, unknown>)[key] = value;
	}
	card.appendChild(el);

	return card;
}
```

- [ ] **Step 4: Create the storybook HTML shell**

Create `stories/storybook.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Flowti Component Storybook</title>
	<!-- Loads only tokens (with fallback defaults) — no Obsidian dependency.
	     Components render using fallback values when Obsidian vars are absent. -->
	<link rel="stylesheet" href="../css/00-tokens.css">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			background: var(--flowti-bg-primary, #1e1e2e);
			color: var(--flowti-text, #cdd6f4);
			font-family: var(--flowti-font, sans-serif);
			padding: 2rem;
		}
		nav {
			display: flex;
			gap: 0.5rem;
			margin-bottom: 2rem;
			padding-bottom: 1rem;
			border-bottom: 1px solid var(--flowti-border, #45475a);
		}
		nav button {
			padding: 0.4rem 0.8rem;
			border: 1px solid var(--flowti-border, #45475a);
			border-radius: var(--flowti-radius-sm, 4px);
			background: var(--flowti-bg-secondary, #181825);
			color: var(--flowti-text, #cdd6f4);
			cursor: pointer;
			font-size: 0.85rem;
		}
		nav button:hover { background: var(--flowti-bg-hover, #313244); }
		nav button.active {
			background: var(--flowti-accent, #89b4fa);
			color: var(--flowti-text-on-accent, #1e1e2e);
			border-color: var(--flowti-accent, #89b4fa);
		}
		#storybook-root { min-height: 300px; }
		.storybook-header {
			font-size: 0.7rem;
			color: var(--flowti-text-muted, #a6adc8);
			margin-bottom: 1.5rem;
		}
	</style>
</head>
<body>
	<div class="storybook-header">FLOWTI COMPONENT STORYBOOK</div>
	<nav id="storybook-nav"></nav>
	<div id="storybook-root"></div>
	<script type="module" src="./storybook-bundle.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create the storybook entry point**

This module discovers and loads all stories, builds navigation, and renders the active story:

Create `stories/storybook-entry.ts`:

```typescript
import { renderStory } from './storybook-runner.js';
import type { StoryDef } from './story-types.js';

// Import all stories — add new stories here
import { story as statusBadge } from './status-badge.story.js';

const stories: StoryDef[] = [
	statusBadge,
];

const nav = document.getElementById('storybook-nav')!;
const root = document.getElementById('storybook-root')!;

function showStory(index: number): void {
	// Update nav active state
	nav.querySelectorAll('button').forEach((btn, i) => {
		btn.classList.toggle('active', i === index);
	});
	renderStory(stories[index], root);
}

// Build navigation
for (let i = 0; i < stories.length; i++) {
	const btn = document.createElement('button');
	btn.textContent = stories[i].title;
	btn.addEventListener('click', () => showStory(i));
	nav.appendChild(btn);
}

// Show first story by default
if (stories.length > 0) {
	showStory(0);
}
```

- [ ] **Step 6: Add storybook build to esbuild config**

The storybook needs its own bundle. Add a `--storybook` flag to the existing esbuild config.

Read the current esbuild config to find where to add the storybook build. Then add the following build step — look for where the main build is defined and add a storybook build after it:

Read `esbuild.config.mjs` first. The config uses an async `run()` function. Make these two changes:

**Change 1:** Near the top of the file, where other CLI flags are parsed (look for `process.argv.includes`), add:

```javascript
const storybook = process.argv.includes('--storybook');
```

**Change 2:** Inside `run()`, after the main build succeeds and after any distribution logic (look for the `distributeBuild()` call or the end of the try block), but before `ctx.dispose()`, add:

```javascript
if (storybook) {
	await esbuild.build({
		entryPoints: ['stories/storybook-entry.ts'],
		bundle: true,
		outfile: 'stories/storybook-bundle.js',
		format: 'esm',
		target: 'es2020',
		platform: 'browser',
		sourcemap: true,
		minify: false,
	});
	console.log('Storybook built → stories/storybook-bundle.js');
}
```

- [ ] **Step 7: Add storybook npm script**

Add to `package.json` scripts section:

```json
"storybook": "node esbuild.config.mjs --storybook --no-reports && echo 'Open stories/storybook.html in a browser'"
```

- [ ] **Step 8: Build and verify storybook**

```bash
cd "Development/flowti" && npm run storybook
```

Expected: Build succeeds, `stories/storybook-bundle.js` is created.

- [ ] **Step 9: Verify storybook HTML loads**

Open `Development/flowti/stories/storybook.html` in a browser manually. Expected: see "FLOWTI COMPONENT STORYBOOK" header, "Status Badge" nav button, and all 9 variants rendered.

- [ ] **Step 10: Add storybook build artifacts to .gitignore**

Add to `.gitignore` at the git root:

```
# Storybook build artifacts
Development/flowti/stories/storybook-bundle.js
Development/flowti/stories/storybook-bundle.js.map
```

- [ ] **Step 11: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/stories/" "Development/flowti/esbuild.config.mjs" "Development/flowti/package.json" .gitignore && git commit -m "feat(plugin): add component storybook with status-badge story"
```

---

### Task 7: Component manifest integration

**Files:**
- Modify: `src/ui/components/componentManifest.ts`

Register the new Lit component in the existing component manifest so it's discoverable.

- [ ] **Step 1: Read the current componentManifest.ts**

Read `src/ui/components/componentManifest.ts` to understand the `ComponentMeta` interface and registration pattern.

- [ ] **Step 2: Add the Lit component entry**

Add a new entry to the manifest array for `flowti-status-badge`:

```typescript
{
	id: 'status-badge',
	name: 'Status Badge',
	category: 'shared',
	description: 'A status badge with colored dot indicator for displaying state labels.',
	source: 'components/flowti-status-badge.ts',
	layouts: ['inline'],
	emits: [],
	tags: ['badge', 'status', 'lit'],
}
```

The `lit` tag distinguishes Lit components from legacy imperative components.

- [ ] **Step 3: Verify build**

```bash
cd "Development/flowti" && node esbuild.config.mjs --no-reports 2>&1 | head -5
```

Expected: Build succeeds.

- [ ] **Step 4: Run all tests**

```bash
cd "Development/flowti" && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: All tests pass (existing + new component tests).

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/ui/components/componentManifest.ts" && git commit -m "feat(plugin): register flowti-status-badge in component manifest"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full verification — build, test, lint**

```bash
cd "Development/flowti" && npm test
```

Expected: lint passes, tsc passes, all tests pass.

- [ ] **Step 3: Verify storybook builds**

```bash
cd "Development/flowti" && npm run storybook
```

Expected: Storybook builds successfully.

---

## Deliverables Checklist

After all tasks complete, verify:

- [ ] `lit` is a runtime dependency in Plugin's `package.json`
- [ ] `css/00-tokens.css` defines Flowti design tokens with Obsidian variable fallbacks
- [ ] `src/components/tokens.ts` exports Lit-consumable shared styles
- [ ] `src/components/flowti-element.ts` — base class with loading/error/empty states
- [ ] `src/components/flowti-status-badge.ts` — first portable component
- [ ] `tests/components/test-utils.ts` — fixture, cleanup, shadow DOM query helpers
- [ ] `tests/components/flowti-element.test.ts` — base class tests passing
- [ ] `tests/components/flowti-status-badge.test.ts` — component tests passing
- [ ] `stories/storybook.html` — standalone storybook shell
- [ ] `stories/status-badge.story.ts` — story with 9 variants
- [ ] `npm run storybook` builds and renders correctly
- [ ] `npm test` passes (all existing + new tests)
- [ ] Component registered in `componentManifest.ts`
- [ ] Zero dependency on Flowti CLI
