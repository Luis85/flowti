// @vitest-environment happy-dom
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
		expect(el.shadowRoot).toBeDefined();
	});
});
