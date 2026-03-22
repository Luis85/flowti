/**
 * bt-system.ts — Behavior tree tick system for the game engine.
 *
 * Creates and ticks behavior trees for agents with behaviors[] defined.
 * Throttled to tick every BT_TICK_INTERVAL_MS of game time (not every frame).
 * Produces actions that drive the brain system and world state.
 */

import { createAgentBT, type AgentBT, type FullAgentBT } from "../brain/behavior-tree/bt-factory.js";
import { btTick } from "../brain/behavior-tree/bt-tick.js";
import type { BTAgentObject } from "../brain/behavior-tree/bt-agent.js";
import type {
	AgentToolDeps,
	BTAgentDef,
	IBrainBridge,
	IClock,
	IMerchantBridge,
	INeedsBridge,
	IWorldStateManager,
} from "../brain/behavior-tree/bt-types.js";
import type { PetBTContext } from "../brain/behavior-tree/pet-bt.js";
import type { AgentAction, DashboardAgent } from "../data/types.js";
import type { BTTreeSnapshot, BTNodeState, BTNodeType, BTNodeStatus } from "../store/dashboard-store.js";
import { getTreeNodeDetails, type TreeNodeDetails } from "../brain/behavior-tree/bt-service.js";

// ── Constants ────────────────────────────────────────────────────────

export const BT_TICK_INTERVAL_MS = 3000;
export const PET_TICK_INTERVAL_MS = 1000;

// ── Per-agent entry ──────────────────────────────────────────────────

interface BtEntry {
	// FullAgentBT preserves the concrete BTAgentObject so getAgent() can return
	// the typed reference for needs-snapshot refresh without any cast.
	readonly bt: FullAgentBT;
	accumulator: number;
}

interface PetBtEntry {
	readonly name: string;
	readonly bt: AgentBT;
	accumulator: number;
}

// ── DashboardAgent → BTAgentDef mapping ──────────────────────────────

function toBTAgentDef(agent: DashboardAgent, quirks?: readonly string[]): BTAgentDef {
	return {
		name: agent.name,
		agentType: agent.agentType,
		domain: agent.domain,
		persona: agent.persona,
		mood: agent.mood,
		personality: agent.personality,
		xp: agent.xp,
		level: agent.level,
		attributes: agent.attributes,
		goals: agent.goals?.map((g) => ({
			name: g.text,
			priority: Number(g.priority) || undefined,
		})),
		behaviors: agent.behaviors,
		trustTier: agent.trustTier,
		quirks,
	};
}

// ── Stub deps for Phase 1 ────────────────────────────────────────────

export function createStubDeps(
	worldState: IWorldStateManager,
	clock: IClock,
	needs?: INeedsBridge,
	brain?: IBrainBridge,
	merchant?: IMerchantBridge,
): AgentToolDeps {
	return {
		disk: {
			readFileSync: () => { throw new Error("disk not available in Phase 1"); },
			writeFileSync: () => { throw new Error("disk not available in Phase 1"); },
			existsSync: () => false,
			mkdirSync: () => {},
		},
		paths: {
			join: (...s: string[]) => s.join("/"),
			dirname: (p: string) => p.substring(0, p.lastIndexOf("/")),
			basename: (p: string) => p.substring(p.lastIndexOf("/") + 1),
		},
		clock,
		worldState,
		checkPermission: () => "allowed" as const,
		...(needs && { needs }),
		...(brain && { brain }),
		...(merchant && { merchant }),
	};
}

// ── Snapshot mapping helpers ─────────────────────────────────────────

const NODE_TYPE_MAP: Record<string, BTNodeType> = {
	selector: "selector",
	sequence: "sequence",
	action: "action",
	condition: "condition",
};

const STATE_TO_STATUS: Record<string, BTNodeStatus> = {
	"mistreevous.running": "running",
	"mistreevous.succeeded": "success",
	"mistreevous.failed": "failure",
	"mistreevous.ready": "idle",
};

function mapNodeType(mistreevousType: string): BTNodeType {
	return NODE_TYPE_MAP[mistreevousType] ?? "sequence";
}

function mapNodeStatus(mistreevousState: string): BTNodeStatus {
	return STATE_TO_STATUS[mistreevousState] ?? "idle";
}

function walkNodeDetails(nd: TreeNodeDetails): BTNodeState {
	return {
		id: nd.id,
		label: nd.name,
		type: mapNodeType(nd.type),
		status: mapNodeStatus(nd.state),
		children: (nd.children ?? []).map(walkNodeDetails),
	};
}

/** Compare two snapshots by status values only (ignoring tick counter). */
function snapshotsEqual(a: BTTreeSnapshot, b: BTTreeSnapshot): boolean {
	return nodesEqual(a.root, b.root);
}

function nodesEqual(a: BTNodeState, b: BTNodeState): boolean {
	if (a.id !== b.id || a.status !== b.status) return false;
	if (a.children.length !== b.children.length) return false;
	for (let i = 0; i < a.children.length; i++) {
		if (!nodesEqual(a.children[i], b.children[i])) return false;
	}
	return true;
}

// ── BtSystem ─────────────────────────────────────────────────────────

export class BtSystem {
	private readonly entries = new Map<string, BtEntry>();
	private readonly petEntries = new Map<string, PetBtEntry>();
	private lastActions: AgentAction[] = [];
	private lastSnapshots = new Map<string, BTTreeSnapshot>();
	private tickCount = 0;

	/** Called when a BT snapshot changes (status values differ from previous). */
	onSnapshot?: (agentName: string, snapshot: BTTreeSnapshot) => void;

	/** Register a BT for an agent that has behaviors defined. */
	register(agent: DashboardAgent, deps: AgentToolDeps, quirks?: readonly string[]): void {
		if (this.entries.has(agent.name)) return;
		if (agent.agentType === "npc") return; // NPCs don't get behavior trees
		if (!agent.behaviors || agent.behaviors.length === 0) return;

		const def = toBTAgentDef(agent, quirks);
		const bt = createAgentBT(def, deps);
		this.entries.set(agent.name, { bt, accumulator: 0 });
	}

	/** Remove an agent's BT. */
	unregister(name: string): void {
		this.entries.delete(name);
		this.lastSnapshots.delete(name);
	}

	/** Build a BTTreeSnapshot from a BtEntry's current tree state. */
	buildSnapshot(entry: BtEntry): BTTreeSnapshot {
		const details = getTreeNodeDetails(entry.bt.tree);
		return { root: walkNodeDetails(details), tick: this.tickCount };
	}

	/** Advance all BT accumulators. Tick trees when interval exceeded.
	 *  Returns collected actions from this update. */
	update(deltaMs: number, worldState: IWorldStateManager, clock: IClock): AgentAction[] {
		const actions: AgentAction[] = [];

		for (const [name, entry] of this.entries) {
			entry.accumulator += deltaMs;
			if (entry.accumulator >= BT_TICK_INTERVAL_MS) {
				entry.accumulator -= BT_TICK_INTERVAL_MS;
				this.tickCount++;
				const emitted = btTick(entry.bt.tree, entry.bt.agent, worldState, clock);
				for (const action of emitted) {
					actions.push(action);
				}

				// Build snapshot and emit only when status values changed
				if (this.onSnapshot) {
					const snap = this.buildSnapshot(entry);
					const prev = this.lastSnapshots.get(name);
					if (!prev || !snapshotsEqual(prev, snap)) {
						this.lastSnapshots.set(name, snap);
						this.onSnapshot(name, snap);
					}
				}
			}
		}

		this.lastActions = actions;
		return actions;
	}

	/** Return actions from the most recent update. */
	getActions(): AgentAction[] {
		return this.lastActions;
	}

	/** Check whether an agent has a registered BT. */
	has(name: string): boolean {
		return this.entries.has(name);
	}

	/** Number of registered BTs. */
	get size(): number {
		return this.entries.size;
	}

	/** Get an agent's BT object (for needs snapshot refresh). */
	getAgent(name: string): BTAgentObject | undefined {
		const entry = this.entries.get(name);
		// FullAgentBT.agent is typed as BTAgentObject — no cast needed.
		return entry?.bt.agent;
	}

	/** Get a pet's BT context (for echo/room injection). */
	getPetContext(name: string): PetBTContext | undefined {
		const entry = this.petEntries.get(name);
		return entry?.bt.agent.context as PetBTContext | undefined;
	}

	/** Get all registered pet names. */
	getPetNames(): string[] {
		return [...this.petEntries.keys()];
	}

	/** Register a pet BT. */
	registerPet(name: string, bt: AgentBT): void {
		if (this.petEntries.has(name)) return;
		this.petEntries.set(name, { name, bt, accumulator: 0 });
	}

	/** Remove a pet BT. */
	unregisterPet(name: string): void {
		this.petEntries.delete(name);
	}

	/** Tick pet BTs at PET_TICK_INTERVAL_MS. Returns collected actions. */
	updatePets(deltaMs: number, worldState: IWorldStateManager, clock: IClock): AgentAction[] {
		const actions: AgentAction[] = [];
		for (const [, entry] of this.petEntries) {
			entry.accumulator += deltaMs;
			if (entry.accumulator >= PET_TICK_INTERVAL_MS) {
				entry.accumulator -= PET_TICK_INTERVAL_MS;
				const emitted = btTick(entry.bt.tree, entry.bt.agent, worldState, clock);
				for (const action of emitted) {
					actions.push(action);
				}
			}
		}
		return actions;
	}

	/** Number of registered pet BTs. */
	get petSize(): number {
		return this.petEntries.size;
	}
}
