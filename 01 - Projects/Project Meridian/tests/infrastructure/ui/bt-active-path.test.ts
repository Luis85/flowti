import { describe, it, expect } from 'vitest';
import { extractActivePath } from '../../../src/infrastructure/ui/bt-active-path.js';
import type { NodeDetails } from 'mistreevous/dist/nodes/Node.js';

const READY = 'mistreevous.ready' as const;
const RUNNING = 'mistreevous.running' as const;
const SUCCEEDED = 'mistreevous.succeeded' as const;
const FAILED = 'mistreevous.failed' as const;

function leaf(name: string, state: typeof READY | typeof RUNNING | typeof SUCCEEDED | typeof FAILED, args?: unknown[]): NodeDetails {
	return { id: name, type: 'action', name, state, ...(args !== undefined ? { args } : {}) };
}

function composite(type: 'selector' | 'sequence', children: NodeDetails[], state: typeof READY | typeof RUNNING | typeof SUCCEEDED | typeof FAILED = READY): NodeDetails {
	return { id: type, type, name: type, state, children };
}

describe('extractActivePath', () => {
	it('all-READY tree returns just the root description', () => {
		const tree = composite('selector', [leaf('Eat', READY), leaf('Drink', READY)], READY);
		expect(extractActivePath(tree)).toBe('selector');
	});

	it('single RUNNING leaf returns root → leaf with state', () => {
		const tree = composite('sequence', [leaf('Eat', RUNNING)], RUNNING);
		expect(extractActivePath(tree)).toBe('sequence → Eat (RUNNING)');
	});

	it('nested RUNNING leaf returns full path joined with arrows', () => {
		const tree = composite('selector', [
			composite('sequence', [leaf('BuyItem', RUNNING, ['equipment'])], RUNNING),
		], RUNNING);
		expect(extractActivePath(tree)).toBe('selector → sequence → BuyItem "equipment" (RUNNING)');
	});

	it('selector with FAILED sibling followed by RUNNING follows the RUNNING branch', () => {
		const tree = composite('selector', [
			leaf('Eat', FAILED),
			leaf('Drink', RUNNING),
		], RUNNING);
		expect(extractActivePath(tree)).toBe('selector → Drink (RUNNING)');
	});

	it('selector with no RUNNING child follows the last resolved child (SUCCEEDED)', () => {
		const tree = composite('selector', [
			leaf('Eat', FAILED),
			leaf('Drink', SUCCEEDED),
		], SUCCEEDED);
		expect(extractActivePath(tree)).toBe('selector → Drink (SUCCEEDED)');
	});

	it('sequence with all SUCCEEDED children follows the last child', () => {
		const tree = composite('sequence', [
			leaf('Eat', SUCCEEDED),
			leaf('Drink', SUCCEEDED),
		], SUCCEEDED);
		expect(extractActivePath(tree)).toBe('sequence → Drink (SUCCEEDED)');
	});

	it('composite with all-READY children stops at the composite', () => {
		const tree = composite('selector', [leaf('Eat', READY), leaf('Drink', READY)], READY);
		expect(extractActivePath(tree)).toBe('selector');
	});

	it('FAILED leaf appends (FAILED) suffix', () => {
		const tree = composite('sequence', [leaf('Eat', FAILED)], FAILED);
		expect(extractActivePath(tree)).toBe('sequence → Eat (FAILED)');
	});

	it('READY root with no state suffix', () => {
		const tree: NodeDetails = { id: 'root', type: 'selector', name: 'selector', state: READY };
		expect(extractActivePath(tree)).toBe('selector');
	});
});
