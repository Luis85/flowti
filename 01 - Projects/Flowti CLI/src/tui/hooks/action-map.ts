/**
 * action-map.ts — Lightweight action dispatch map.
 *
 * Replaces handler-registry for TUI pages. Actions are registered as
 * simple async functions keyed by action ID. Pages call executeAction()
 * through useActionBridge, which routes here.
 */

export interface ActionContext {
	readonly actionId: string;
	readonly params: Readonly<Record<string, string>>;
}

type ActionFn = (ctx: ActionContext) => Promise<void> | void;

const actions = new Map<string, ActionFn>();

export function registerTuiAction(id: string, fn: ActionFn): void {
	actions.set(id, fn);
}

export async function executeAction(id: string, ctx: ActionContext): Promise<void> {
	const fn = actions.get(id);
	if (!fn) throw new Error(`Unknown action: ${id}`);
	await fn(ctx);
}

export function hasAction(id: string): boolean {
	return actions.has(id);
}
