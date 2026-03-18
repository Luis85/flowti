// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from '../test-utils.js';
import type { ActivityEntry } from '../../../src/domain/server/types.js';

import '../../../src/components/server/flowti-activity-feed.js';

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
	return {
		id: 'e1',
		timestamp: '2026-03-18T10:05:30.000Z',
		agentName: 'Atlas',
		actionType: 'build',
		text: 'Building project',
		expanded: false,
		...overrides,
	};
}

describe('flowti-activity-feed', () => {
	afterEach(() => cleanup());

	it('is defined as a custom element', () => {
		expect(customElements.get('flowti-activity-feed')).toBeDefined();
	});

	it('renders empty state when no entries', async () => {
		const el = await fixture('flowti-activity-feed', { entries: [] });
		expect(shadowText(el)).toContain('No activity yet');
	});

	it('renders entry lines for each entry', async () => {
		const entries = [
			makeEntry({ id: 'e1', agentName: 'Atlas' }),
			makeEntry({ id: 'e2', agentName: 'Vex' }),
		];
		const el = await fixture('flowti-activity-feed', { entries });
		const entryEls = shadowQueryAll(el, '.entry');
		expect(entryEls.length).toBe(2);
		expect(shadowText(el)).toContain('Atlas');
		expect(shadowText(el)).toContain('Vex');
	});

	it('formats timestamp as HH:MM:SS', async () => {
		const entries = [makeEntry({ timestamp: '2026-03-18T14:30:45.000Z' })];
		const el = await fixture('flowti-activity-feed', { entries });
		const text = shadowText(el);
		// The exact time depends on local timezone, but the format should have colons
		const timestampEl = shadowQuery(el, '.entry-timestamp');
		expect(timestampEl?.textContent).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
	});

	it('toggles expanded state when entry is clicked', async () => {
		const entries = [makeEntry({ id: 'e1', expanded: false })];
		const el = await fixture('flowti-activity-feed', { entries });

		// Verify not expanded initially
		let expandedCard = shadowQuery(el, '.entry-expanded');
		expect(expandedCard).toBeNull();

		// Click to expand
		const entry = shadowQuery(el, '.entry') as HTMLElement;
		entry.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		expandedCard = shadowQuery(el, '.entry-expanded');
		expect(expandedCard).not.toBeNull();
	});

	it('dispatches feed-pause event when pause button clicked', async () => {
		const entries = [makeEntry()];
		const el = await fixture('flowti-activity-feed', { entries, paused: false });
		let fired = false;
		el.addEventListener('feed-pause', () => { fired = true; });
		const btn = shadowQuery(el, '.btn-pause') as HTMLElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it('dispatches feed-resume event when resume button clicked while paused', async () => {
		const entries = [makeEntry()];
		const el = await fixture('flowti-activity-feed', { entries, paused: true });
		let fired = false;
		el.addEventListener('feed-resume', () => { fired = true; });
		const btn = shadowQuery(el, '.btn-pause') as HTMLElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it('dispatches feed-clear event when clear button clicked', async () => {
		const entries = [makeEntry()];
		const el = await fixture('flowti-activity-feed', { entries });
		let fired = false;
		el.addEventListener('feed-clear', () => { fired = true; });
		const btn = shadowQuery(el, '.btn-clear') as HTMLElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it('applies autoscroll class when not paused', async () => {
		const entries = [makeEntry()];
		const el = await fixture('flowti-activity-feed', { entries, paused: false });
		const log = shadowQuery(el, '.log');
		expect(log?.classList.contains('log--autoscroll')).toBe(true);
	});

	it('removes autoscroll class when paused', async () => {
		const entries = [makeEntry()];
		const el = await fixture('flowti-activity-feed', { entries, paused: true });
		const log = shadowQuery(el, '.log');
		expect(log?.classList.contains('log--autoscroll')).toBe(false);
	});

	it('displays entry count in toolbar', async () => {
		const entries = [
			makeEntry({ id: 'e1' }),
			makeEntry({ id: 'e2' }),
			makeEntry({ id: 'e3' }),
		];
		const el = await fixture('flowti-activity-feed', { entries });
		const count = shadowQuery(el, '.entry-count');
		expect(count?.textContent).toContain('3 entries');
	});
});
