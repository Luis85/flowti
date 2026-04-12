import type { NodeDetails } from 'mistreevous/dist/nodes/Node.js';

/**
 * Walks the tree following state-priority rules to find the "active" path:
 *   1. At each composite, follow the first child in RUNNING state.
 *   2. If no RUNNING child, follow the last child in SUCCEEDED or FAILED state.
 *   3. If all children are READY, stop at the current composite.
 *
 * Returns a compact path string joined with ` → `, with the final node's
 * state appended in parentheses (unless READY).
 *
 * Used by both the manual snapshot and the recording feature to show
 * "what is the agent doing right now" in a single line.
 */
export function extractActivePath(details: NodeDetails): string {
	const path: string[] = [];
	let node: NodeDetails = details;
	let last: NodeDetails = details;

	// Single walk: accumulate path and remember the deepest node we reach.
	for (;;) {
		path.push(describeNode(node));
		last = node;
		const next = pickNextChild(node);
		if (next === undefined) break;
		node = next;
	}

	return path.join(' → ') + stateLabel(last.state);
}

/**
 * Walks the tree to the active leaf node and returns its name + normalized state.
 * Used by BehaviorTreeSystem to emit BtEvaluated events.
 */
export function extractLeafNode(details: NodeDetails): { name: string; state: string } {
	let node: NodeDetails = details;
	for (;;) {
		const next = pickNextChild(node);
		if (next === undefined) break;
		node = next;
	}
	return { name: describeNode(node), state: normalizeState(node.state) };
}

function pickNextChild(node: NodeDetails): NodeDetails | undefined {
	const children = node.children;
	if (children === undefined || children.length === 0) return undefined;

	// Fallback 0: first RUNNING child
	for (const child of children) {
		if (child.state === 'mistreevous.running') return child;
	}

	// Fallback 1: last SUCCEEDED or FAILED child (most recently resolved)
	for (let i = children.length - 1; i >= 0; i--) {
		const child = children[i];
		if (child === undefined) continue;
		if (child.state === 'mistreevous.succeeded' || child.state === 'mistreevous.failed') {
			return child;
		}
	}

	// Fallback 2: no child has been evaluated — stop at this composite
	return undefined;
}

function describeNode(node: NodeDetails): string {
	// Show the distinctive label: the name if it differs from type
	// (e.g., action "Eat"), otherwise the type (e.g., composite "sequence").
	const label = node.name !== node.type ? node.name : node.type;
	const argsLabel = node.args !== undefined && node.args.length > 0
		? ` ${node.args.map(formatArg).join(', ')}`
		: '';
	return `${label}${argsLabel}`;
}

function formatArg(arg: unknown): string {
	if (typeof arg === 'string') return `"${arg}"`;
	if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
	return JSON.stringify(arg);
}

function normalizeState(state: string): string {
	switch (state) {
		case 'mistreevous.running': return 'RUNNING';
		case 'mistreevous.succeeded': return 'SUCCEEDED';
		case 'mistreevous.failed': return 'FAILED';
		default: return 'READY';
	}
}

function stateLabel(state: string): string {
	switch (state) {
		case 'mistreevous.running': return ' (RUNNING)';
		case 'mistreevous.succeeded': return ' (SUCCEEDED)';
		case 'mistreevous.failed': return ' (FAILED)';
		default: return '';
	}
}
