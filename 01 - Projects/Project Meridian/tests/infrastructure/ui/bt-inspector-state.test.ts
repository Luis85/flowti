import { describe, it, expect } from 'vitest';
import { isTreeRef, parseState } from '../../../src/infrastructure/ui/bt-inspector-state.js';

describe('isTreeRef', () => {
	it('accepts a valid base ref', () => {
		expect(isTreeRef({ kind: 'base', path: 'behavior-trees/base.mdsl' })).toBe(true);
	});

	it('accepts a valid job ref', () => {
		expect(isTreeRef({
			kind: 'job',
			branchPath: 'jobs/settler.mdsl',
			basePath: 'behavior-trees/base.mdsl',
		})).toBe(true);
	});

	it('rejects null and non-objects', () => {
		expect(isTreeRef(null)).toBe(false);
		expect(isTreeRef(undefined)).toBe(false);
		expect(isTreeRef('base')).toBe(false);
		expect(isTreeRef(42)).toBe(false);
	});

	it('rejects objects with unknown kind', () => {
		expect(isTreeRef({ kind: 'something', path: 'x' })).toBe(false);
	});

	it('rejects base ref missing path', () => {
		expect(isTreeRef({ kind: 'base' })).toBe(false);
		expect(isTreeRef({ kind: 'base', path: 42 })).toBe(false);
	});

	it('rejects job ref missing either path', () => {
		expect(isTreeRef({ kind: 'job', branchPath: 'x' })).toBe(false);
		expect(isTreeRef({ kind: 'job', basePath: 'x' })).toBe(false);
		expect(isTreeRef({ kind: 'job', branchPath: 'x', basePath: 42 })).toBe(false);
	});
});

describe('parseState', () => {
	it('returns empty state for non-objects', () => {
		expect(parseState(null)).toEqual({});
		expect(parseState(undefined)).toEqual({});
		expect(parseState('foo')).toEqual({});
		expect(parseState(42)).toEqual({});
	});

	it('returns empty state for empty object', () => {
		expect(parseState({})).toEqual({});
	});

	it('extracts only agentId when only agentId present', () => {
		expect(parseState({ agentId: 'alice' })).toEqual({ agentId: 'alice' });
	});

	it('extracts static ref + label when both present', () => {
		const raw = {
			staticRef: { kind: 'base', path: 'behavior-trees/base.mdsl' },
			staticLabel: 'base.mdsl',
		};
		const parsed = parseState(raw);
		expect(parsed.staticRef).toEqual({ kind: 'base', path: 'behavior-trees/base.mdsl' });
		expect(parsed.staticLabel).toBe('base.mdsl');
	});

	it('ignores static ref without label', () => {
		const raw = { staticRef: { kind: 'base', path: 'x' } };
		expect(parseState(raw)).toEqual({});
	});

	it('ignores static label without ref', () => {
		expect(parseState({ staticLabel: 'base.mdsl' })).toEqual({});
	});

	it('ignores invalid static ref shape', () => {
		const raw = { staticRef: { kind: 'mystery' }, staticLabel: 'x' };
		expect(parseState(raw)).toEqual({});
	});

	it('ignores non-string agentId', () => {
		expect(parseState({ agentId: 123 })).toEqual({});
	});

	it('accepts both agentId and staticRef simultaneously (caller decides priority)', () => {
		const raw = {
			agentId: 'alice',
			staticRef: { kind: 'base', path: 'x' },
			staticLabel: 'x',
		};
		const parsed = parseState(raw);
		expect(parsed.agentId).toBe('alice');
		expect(parsed.staticRef).toBeDefined();
		expect(parsed.staticLabel).toBe('x');
	});

	it('drops arbitrary extra keys', () => {
		const raw = { agentId: 'alice', unknownKey: 'ignored', another: 42 };
		const parsed = parseState(raw);
		expect(parsed).toEqual({ agentId: 'alice' });
	});
});
