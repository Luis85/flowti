/**
 * bt-service.ts — Vendor adapter for the mistreevous behavior tree library.
 *
 * This is the ONLY file that imports mistreevous. All other BT code
 * imports types and utilities from here.
 */

import { BehaviourTree, State } from "mistreevous";

// ── Our state type — replaces mistreevous State enum ──────────
// mistreevous State is a string enum: State.SUCCEEDED = "mistreevous.succeeded" etc.
// NodeState provides clean, vendor-neutral string literals.
export type NodeState = "succeeded" | "running" | "failed";

// ── Conversion ────────────────────────────────────────────────
const STATE_MAP: Record<string, NodeState> = {
	[State.SUCCEEDED]: "succeeded",
	[State.RUNNING]: "running",
	[State.FAILED]: "failed",
};

export function toNodeState(state: State): NodeState {
	return STATE_MAP[state] ?? "failed";
}

export function fromNodeState(ns: NodeState): State {
	switch (ns) {
		case "succeeded": return State.SUCCEEDED;
		case "running": return State.RUNNING;
		case "failed": return State.FAILED;
	}
}

// ── Tree lifecycle ────────────────────────────────────────────
export function createTree(mdsl: string, agent: object): BehaviourTree {
	return new BehaviourTree(mdsl, agent as Record<string, unknown>);
}

export function stepTree(tree: BehaviourTree): void {
	tree.step();
}

/** Reset every node to READY — use after a step throws so the next tick starts clean. */
export function resetTree(tree: BehaviourTree): void {
	tree.reset();
}

// Re-export opaque types for consumer signatures
export type { BehaviourTree, State };
