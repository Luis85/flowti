import { BehaviourTree } from 'mistreevous';
import type { NodeDetails } from 'mistreevous/dist/nodes/Node.js';
import type { Agent } from 'mistreevous/dist/Agent.js';
import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from '../entity/agent-spawner.js';
import { createMDSLLoader } from '../entity/bt-loader.js';

/**
 * A reference to a behavior tree that can be loaded into the inspector.
 * Base trees (behavior-trees/base.mdsl) are standalone.
 * Job trees (jobs/*.mdsl) are branch definitions that must be composed with base.
 */
export type TreeRef =
	| { kind: 'base'; path: string }
	| { kind: 'job'; branchPath: string; basePath: string };

/**
 * Loads an MDSL file and returns its NodeDetails structure.
 * For job trees, composes the branch with base.mdsl (matches how bt-loader does it at runtime).
 * The returned tree has all nodes in READY state — no stepping is performed.
 *
 * The stub agent exists only to satisfy the `new BehaviourTree(mdsl, agent)` type
 * signature. It is never stepped, so no action callbacks are invoked.
 *
 * Verified against mistreevous ^4.3.1. If a future version starts eagerly validating
 * that agent actions exist (e.g. via `typeof agent[actionName] === 'function'`), this
 * stub still satisfies those checks for string property access. Symbol property access
 * (iterators, thenables) returns `undefined` — a safe no-op.
 *
 * If an upgrade breaks this, the loader will throw from `new BehaviourTree(...)`
 * — that exception is caught by the caller (bt-inspector-view) and shown as a
 * "Failed to load tree" error instead of crashing the view.
 */
export async function loadStaticTree(
	vault: VaultReader,
	ref: TreeRef,
	logger: Logger,
): Promise<NodeDetails> {
	let mdsl: string;

	if (ref.kind === 'base') {
		mdsl = await vault.read(ref.path);
	} else {
		const mdslLoader = createMDSLLoader(logger);
		const result = await mdslLoader.loadComposed(vault, ref.basePath, ref.branchPath);
		if (!result.valid || result.mdsl === null) {
			const firstError = result.errors[0];
			const message = firstError !== undefined ? `${firstError.file}: ${firstError.message}` : 'unknown composition error';
			throw new Error(`Failed to load ${ref.branchPath}: ${message}`);
		}
		mdsl = result.mdsl;
	}

	const stubAgent = createStubAgent();
	const tree = new BehaviourTree(mdsl, stubAgent);
	return tree.getTreeNodeDetails();
}

/**
 * Build a Proxy that appears to have every string-named action as a no-op function.
 * Symbol-keyed access (e.g. `Symbol.iterator`, `Symbol.toPrimitive`, `.then`) returns
 * undefined so the stub doesn't masquerade as iterable, thenable, or primitive-coercible.
 */
function createStubAgent(): Agent {
	return new Proxy({} as Agent, {
		get(_target, prop) {
			if (typeof prop === 'symbol') return undefined;
			// `then` is checked by Promise.resolve() to detect thenables — return undefined
			// so the stub never accidentally acts as a Promise.
			if (prop === 'then') return undefined;
			return () => undefined;
		},
	});
}
