/**
 * bt-system.ts — Behavior tree tick system for the game engine.
 *
 * Creates and ticks behavior trees for agents with behaviors[] defined.
 * Throttled to tick at randomized intervals (2.5-4s) per agent.
 * BT actions write directly to the agent's blackboard — no collected
 * actions, no worldState bridge.
 */

import { createAgentBT, type AgentBT, type FullAgentBT } from "../brain/behavior-tree/bt-factory.js";
import { btTick } from "../brain/behavior-tree/bt-tick.js";
import type { BTAgentObject } from "../brain/behavior-tree/bt-agent.js";
import type {
	AgentNeeds,
	AgentToolDeps,
	BTAgentDef,
	IClock,
	IMerchantBridge,
} from "../brain/behavior-tree/bt-types.js";
import type { PetBTContext } from "../brain/behavior-tree/pet-bt.js";
import type { DashboardAgent } from "../data/types.js";
import type { BTTreeSnapshot, BTNodeState, BTNodeType, BTNodeStatus } from "../store/dashboard-store.js";
import { getTreeNodeDetails, type TreeNodeDetails } from "../brain/behavior-tree/bt-service.js";
import type { AgentBlackboard, BlackboardManager } from "./blackboard.js";

// ── Constants ────────────────────────────────────────────────────────

import { DEFAULT_WORLD_CONFIG } from "../data/world-config.js";

export const BT_TICK_INTERVAL_MS = DEFAULT_WORLD_CONFIG.behavior.btTickMinMs;
export const PET_TICK_INTERVAL_MS = 1000;

function randomTickInterval(): number {
	const { btTickMinMs, btTickMaxMs } = DEFAULT_WORLD_CONFIG.behavior;
	return btTickMinMs + Math.random() * (btTickMaxMs - btTickMinMs);
}

// ── Per-agent entry ──────────────────────────────────────────────────

interface BtEntry {
	readonly bt: FullAgentBT;
	accumulator: number;
	tickInterval: number;
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

// ── Create deps for BT agent ─────────────────────────────────────────

export function createBtDeps(
	blackboard: AgentBlackboard,
	clock: IClock,
	options?: {
		merchant?: IMerchantBridge;
		applyNeedsEffect?: (effect: Partial<AgentNeeds>) => void;
	},
): AgentToolDeps {
	return {
		disk: {
			readFileSync: () => { throw new Error("disk not available"); },
			writeFileSync: () => { throw new Error("disk not available"); },
			existsSync: () => false,
			mkdirSync: () => {},
		},
		paths: {
			join: (...s: string[]) => s.join("/"),
			dirname: (p: string) => p.substring(0, p.lastIndexOf("/")),
			basename: (p: string) => p.substring(p.lastIndexOf("/") + 1),
		},
		clock,
		checkPermission: () => "allowed" as const,
		blackboard,
		...(options?.merchant && { merchant: options.merchant }),
		...(options?.applyNeedsEffect && { applyNeedsEffect: options.applyNeedsEffect }),
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
	private lastSnapshots = new Map<string, BTTreeSnapshot>();
	private tickCount = 0;

	/** Called when a BT snapshot changes (status values differ from previous). */
	onSnapshot?: (agentName: string, snapshot: BTTreeSnapshot) => void;

	/** Register a BT for an agent that has behaviors defined. */
	register(agent: DashboardAgent, deps: AgentToolDeps, quirks?: readonly string[]): void {
		if (this.entries.has(agent.name)) return;
		if (agent.agentType === "npc") return;
		if (!agent.behaviors || agent.behaviors.length === 0) return;

		const def = toBTAgentDef(agent, quirks);
		const bt = createAgentBT(def, deps);
		const tickInterval = randomTickInterval();
		const stagger = (this.entries.size * 397) % tickInterval;
		this.entries.set(agent.name, { bt, accumulator: stagger, tickInterval });
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

	/**
	 * Advance all BT accumulators. Tick trees when interval exceeded.
	 * BT actions write directly to blackboards during evaluation.
	 */
	update(deltaMs: number, blackboards: BlackboardManager): void {
		for (const [name, entry] of this.entries) {
			// Advance intentTimer every frame (used by IsIdleLongEnough, IsTalkingTooLong).
			// Reset when intent changes so timers track duration in current state.
			if (blackboards.has(name)) {
				const bb = blackboards.get(name);
				const ctx = entry.bt.agent.context as { intentTimer?: number; _lastIntent?: string };
				if (typeof ctx.intentTimer === "number") {
					const currentIntent = bb.intent;
					if (ctx._lastIntent !== undefined && ctx._lastIntent !== currentIntent) {
						ctx.intentTimer = 0;
					}
					ctx.intentTimer += deltaMs;
					ctx._lastIntent = currentIntent;
				}
			}

			entry.accumulator += deltaMs;
			if (entry.accumulator >= entry.tickInterval) {
				entry.accumulator -= entry.tickInterval;
				entry.tickInterval = randomTickInterval();
				this.tickCount++;

				// Get the agent's blackboard for this tick
				const bb = blackboards.has(name) ? blackboards.get(name) : undefined;
				btTick(entry.bt.tree, entry.bt.agent, bb);

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
	}

	/** Check whether an agent has a registered BT. */
	has(name: string): boolean {
		return this.entries.has(name);
	}

	/** Number of registered BTs. */
	get size(): number {
		return this.entries.size;
	}

	/** Get an agent's BT object (for context refresh). */
	getAgent(name: string): BTAgentObject | undefined {
		const entry = this.entries.get(name);
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

	/** Tick pet BTs at PET_TICK_INTERVAL_MS. */
	updatePets(deltaMs: number): void {
		for (const [, entry] of this.petEntries) {
			entry.accumulator += deltaMs;
			if (entry.accumulator >= PET_TICK_INTERVAL_MS) {
				entry.accumulator -= PET_TICK_INTERVAL_MS;
				btTick(entry.bt.tree, entry.bt.agent);
			}
		}
	}

	/** Number of registered pet BTs. */
	get petSize(): number {
		return this.petEntries.size;
	}
}
