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
 * Stub agent is used only to satisfy the mistreevous Agent type at construction.
 * The BehaviourTree constructor never invokes agent methods, so return values don't matter.
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

	// Proxy stub — returns no-op functions for any property access.
	// BehaviourTree constructor validates structure but never calls agent methods.
	const stubAgent = new Proxy({} as Agent, {
		get: () => () => undefined,
	});

	const tree = new BehaviourTree(mdsl, stubAgent);
	return tree.getTreeNodeDetails();
}
