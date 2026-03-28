import { describe, it, expect } from 'vitest';
import { createQuarantine } from '../../../src/infrastructure/vault/quarantine.js';

describe('Quarantine', () => {
	it('starts empty', () => {
		const q = createQuarantine();
		expect(q.quarantined).toEqual([]);
	});

	it('adds and checks paths', () => {
		const q = createQuarantine();
		q.add('agents/bad.md');
		expect(q.has('agents/bad.md')).toBe(true);
		expect(q.has('agents/good.md')).toBe(false);
		expect(q.quarantined).toEqual(['agents/bad.md']);
	});

	it('deduplicates on add', () => {
		const q = createQuarantine();
		q.add('agents/bad.md');
		q.add('agents/bad.md');
		expect(q.quarantined).toHaveLength(1);
	});

	it('clears all entries', () => {
		const q = createQuarantine();
		q.add('a.md');
		q.add('b.md');
		q.clear();
		expect(q.quarantined).toEqual([]);
		expect(q.has('a.md')).toBe(false);
	});

	it('returns a copy from quarantined, not the live array', () => {
		const q = createQuarantine();
		q.add('a.md');
		const snapshot = q.quarantined;
		q.add('b.md');
		expect(snapshot).toHaveLength(1);
		expect(q.quarantined).toHaveLength(2);
	});
});
