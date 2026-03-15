// @vitest-environment happy-dom
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
