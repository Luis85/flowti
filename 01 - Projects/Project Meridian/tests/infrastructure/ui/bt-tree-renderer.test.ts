import { describe, it, expect } from 'vitest';
import { renderTree } from '../../../src/infrastructure/ui/bt-tree-renderer.js';
import type { NodeDetails } from 'mistreevous/dist/nodes/Node.js';

const READY = 'mistreevous.ready' as const;
const RUNNING = 'mistreevous.running' as const;
const SUCCEEDED = 'mistreevous.succeeded' as const;
const FAILED = 'mistreevous.failed' as const;

function leaf(name: string, state: typeof READY | typeof RUNNING | typeof SUCCEEDED | typeof FAILED, type = 'action', args?: unknown[]): NodeDetails {
	return { id: name, type, name, state, ...(args !== undefined ? { args } : {}) };
}

function composite(type: 'selector' | 'sequence', children: NodeDetails[], state: typeof READY | typeof RUNNING | typeof SUCCEEDED | typeof FAILED = READY): NodeDetails {
	return { id: type, type, name: type, state, children };
}

describe('renderTree', () => {
	it('renders a single leaf node', () => {
		const el = renderTree(leaf('Eat', READY));
		expect(el.textContent).toContain('Eat');
		expect(el.querySelector('.bt-node')).not.toBeNull();
	});

	it('renders a composite with children', () => {
		const tree = composite('selector', [leaf('Eat', READY), leaf('Drink', READY)]);
		const el = renderTree(tree);
		expect(el.textContent).toContain('selector');
		expect(el.textContent).toContain('Eat');
		expect(el.textContent).toContain('Drink');
		// Two child nodes + one composite = 3 .bt-node elements total
		expect(el.querySelectorAll('.bt-node')).toHaveLength(3);
	});

	it('READY state uses the ready class', () => {
		const el = renderTree(leaf('Eat', READY));
		expect(el.querySelector('.bt-node-ready')).not.toBeNull();
	});

	it('RUNNING state uses the running class and shows arrow', () => {
		const el = renderTree(leaf('Eat', RUNNING));
		expect(el.querySelector('.bt-node-running')).not.toBeNull();
		expect(el.textContent).toContain('▸');
		expect(el.textContent).toContain('(RUNNING)');
	});

	it('SUCCEEDED state uses the succeeded class and shows check', () => {
		const el = renderTree(leaf('Eat', SUCCEEDED));
		expect(el.querySelector('.bt-node-succeeded')).not.toBeNull();
		expect(el.textContent).toContain('✓');
	});

	it('FAILED state uses the failed class and shows cross', () => {
		const el = renderTree(leaf('Eat', FAILED));
		expect(el.querySelector('.bt-node-failed')).not.toBeNull();
		expect(el.textContent).toContain('✗');
	});

	it('renders args inline for action nodes', () => {
		const el = renderTree(leaf('BuyItem', READY, 'action', ['equipment']));
		expect(el.textContent).toContain('BuyItem');
		expect(el.textContent).toContain('"equipment"');
	});

	it('nested composites produce correct depth via padding-left', () => {
		const tree = composite('selector', [
			composite('sequence', [leaf('Eat', READY)]),
		]);
		const el = renderTree(tree);
		const nodes = el.querySelectorAll('.bt-node');
		// Root selector at depth 0, inner sequence at depth 1, inner leaf at depth 2
		expect(nodes).toHaveLength(3);
		const firstPadding = (nodes[0] as HTMLElement).style.paddingLeft;
		const thirdPadding = (nodes[2] as HTMLElement).style.paddingLeft;
		expect(firstPadding).toBe('0px');
		expect(thirdPadding).toBe('32px');
	});
});
