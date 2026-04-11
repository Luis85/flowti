import type { NodeDetails } from 'mistreevous/dist/nodes/Node.js';

const INDENT_PX = 16;

/**
 * Renders a mistreevous NodeDetails tree as a nested HTML structure.
 * Pure function — takes details, returns an HTMLElement. No side effects.
 * Each node is a .bt-node div with depth-based indentation and a state class.
 */
export function renderTree(details: NodeDetails): HTMLElement {
	const container = document.createElement('div');
	container.className = 'bt-tree';
	renderNode(details, 0, container);
	return container;
}

function renderNode(details: NodeDetails, depth: number, container: HTMLElement): void {
	const row = document.createElement('div');
	row.className = `bt-node ${stateClass(details.state)}`;
	row.style.paddingLeft = `${String(depth * INDENT_PX)}px`;
	row.textContent = formatNode(details);
	container.appendChild(row);

	if (details.children !== undefined) {
		for (const child of details.children) {
			renderNode(child, depth + 1, container);
		}
	}
}

function stateClass(state: string): string {
	switch (state) {
		case 'mistreevous.running': return 'bt-node-running';
		case 'mistreevous.succeeded': return 'bt-node-succeeded';
		case 'mistreevous.failed': return 'bt-node-failed';
		default: return 'bt-node-ready';
	}
}

function stateIcon(state: string): string {
	switch (state) {
		case 'mistreevous.running': return '▸ ';
		case 'mistreevous.succeeded': return '✓ ';
		case 'mistreevous.failed': return '✗ ';
		default: return '◦ ';
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

function formatNode(details: NodeDetails): string {
	const icon = stateIcon(details.state);
	// Show the distinctive label: the name if it differs from type (e.g. action "Eat"),
	// otherwise the type itself (e.g. composite "sequence"). Matches bt-active-path.
	const label = details.name !== details.type ? details.name : details.type;
	const argsLabel = details.args !== undefined && details.args.length > 0
		? ` ${details.args.map(formatArg).join(', ')}`
		: '';
	return `${icon}${label}${argsLabel}${stateLabel(details.state)}`;
}

function formatArg(arg: unknown): string {
	if (typeof arg === 'string') return `"${arg}"`;
	if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
	return JSON.stringify(arg);
}
