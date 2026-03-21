/**
 * social-system.ts — Proximity conversation detection between related agents.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

import type { BrainState } from "../brain/brain-types.js";
import type { AgentNeeds } from "./needs-system.js";
import { CONVERSATION_LINES } from "./social-conversation-lines.js";

export interface SocialAgent {
	readonly socialRadius: number;
	readonly personality: readonly string[];
	readonly domain: string;
	readonly relationships: readonly { target: string; type: string }[];
}

interface SocialEntry extends SocialAgent {
	proximityTimers: Map<string, number>;
}

const PROXIMITY_THRESHOLD_MS = 4000;
const PAIR_COOLDOWN_MS = 60000;
const IDLE_STATES: readonly BrainState[] = ["idle", "on-break", "waiting"];

const CLUSTER_THRESHOLD_MS = 6000;
const CLUSTER_COOLDOWN_MS = 180000;
const CLUSTER_MIN_SIZE = 3;
const CLUSTER_MIN_FOCUS = 20;

type ConversationCallback = (agentA: string, agentB: string, lineA: string, lineB: string) => void;
type ClusterCallback = (members: string[]) => void;

// ── Graph helpers ────────────────────────────────────────────────────

/** Build adjacency map from proximate pairs among eligible agents. */
function buildAdjacency(eligible: string[], proximatePairs: Set<string>): Map<string, Set<string>> {
	const adjacency = new Map<string, Set<string>>();
	for (const name of eligible) adjacency.set(name, new Set());
	for (const name of eligible) {
		for (const other of eligible) {
			if (name >= other) continue;
			if (proximatePairs.has(`${name}|${other}`)) {
				adjacency.get(name)!.add(other);
				adjacency.get(other)!.add(name);
			}
		}
	}
	return adjacency;
}

/** Find connected components via BFS. */
function findConnectedComponents(eligible: string[], adjacency: Map<string, Set<string>>): string[][] {
	const visited = new Set<string>();
	const components: string[][] = [];
	for (const start of eligible) {
		if (visited.has(start)) continue;
		const component: string[] = [];
		const queue: string[] = [start];
		visited.add(start);
		while (queue.length > 0) {
			const current = queue.shift()!;
			component.push(current);
			for (const neighbor of adjacency.get(current) ?? []) {
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					queue.push(neighbor);
				}
			}
		}
		components.push(component);
	}
	return components;
}

/** Check whether all members of a cluster are still pairwise proximate. */
function isClusterStillTogether(members: string[], eligible: string[], proximatePairs: Set<string>): boolean {
	if (!members.every((m) => eligible.includes(m))) return false;
	for (const m of members) {
		for (const other of members) {
			if (m >= other) continue;
			if (!proximatePairs.has(`${m}|${other}`)) return false;
		}
	}
	return true;
}

// ── SocialSystem ─────────────────────────────────────────────────────

export class SocialSystem {
	private readonly entries = new Map<string, SocialEntry>();
	private readonly pairCooldowns = new Map<string, number>();
	private callback: ConversationCallback | null = null;
	private clusterCallback: ClusterCallback | null = null;
	/** Per-cluster proximity timers keyed by sorted-name hash. */
	private readonly clusterTimers = new Map<string, number>();
	/** Cooldowns for cluster compositions already fired. */
	private readonly clusterCooldowns = new Map<string, number>();

	onConversation(cb: ConversationCallback): void {
		this.callback = cb;
	}

	offConversation(): void {
		this.callback = null;
	}

	onCluster(cb: ClusterCallback): void {
		this.clusterCallback = cb;
	}

	offCluster(): void {
		this.clusterCallback = null;
	}

	register(name: string, agent: SocialAgent): void {
		this.entries.set(name, { ...agent, proximityTimers: new Map() });
	}

	unregister(name: string): void {
		this.entries.delete(name);
	}

	update(
		deltaMs: number,
		getPosition: (name: string) => { x: number; y: number },
		getState: (name: string) => BrainState,
		getNeeds: (name: string) => AgentNeeds,
	): void {
		// Decrement pair cooldowns
		for (const [key, remaining] of this.pairCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.pairCooldowns.delete(key);
			else this.pairCooldowns.set(key, updated);
		}

		// Decrement cluster cooldowns
		for (const [key, remaining] of this.clusterCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.clusterCooldowns.delete(key);
			else this.clusterCooldowns.set(key, updated);
		}

		const names = [...this.entries.keys()];
		/** Adjacency set of pairs within social radius (used for cluster detection). */
		const proximatePairs = new Set<string>();

		for (let i = 0; i < names.length; i++) {
			const nameA = names[i];
			const entryA = this.entries.get(nameA)!;
			if (!IDLE_STATES.includes(getState(nameA))) continue;
			const posA = getPosition(nameA);

			for (let j = i + 1; j < names.length; j++) {
				const nameB = names[j];
				const entryB = this.entries.get(nameB)!;
				if (!IDLE_STATES.includes(getState(nameB))) continue;

				const pairKey = `${nameA}|${nameB}`;

				const posB = getPosition(nameB);
				const dx = posA.x - posB.x;
				const dy = posA.y - posB.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				const maxRadius = Math.max(entryA.socialRadius, entryB.socialRadius);

				if (dist > maxRadius) {
					entryA.proximityTimers.delete(nameB);
					continue;
				}

				// Within radius — track for both pair conversations and cluster detection
				proximatePairs.add(pairKey);

				if (!this.pairCooldowns.has(pairKey)) {
					const timer = (entryA.proximityTimers.get(nameB) ?? 0) + deltaMs;
					entryA.proximityTimers.set(nameB, timer);

					if (timer >= PROXIMITY_THRESHOLD_MS) {
						entryA.proximityTimers.delete(nameB);
						this.pairCooldowns.set(pairKey, PAIR_COOLDOWN_MS);

						const lineA = this.pickLine(entryA.domain, entryA.personality);
						const lineB = this.pickLine(entryB.domain, entryB.personality);
						this.callback?.(nameA, nameB, lineA, lineB);
					}
				}
			}
		}

		// Cluster detection — find connected components of 3+ idle, high-focus agents
		if (this.clusterCallback) {
			this.updateClusters(deltaMs, names, proximatePairs, getState, getNeeds);
		}
	}

	private updateClusters(
		deltaMs: number,
		names: string[],
		proximatePairs: Set<string>,
		getState: (name: string) => BrainState,
		getNeeds: (name: string) => AgentNeeds,
	): void {
		const eligible = names.filter(
			(n) => IDLE_STATES.includes(getState(n)) && getNeeds(n).focus >= CLUSTER_MIN_FOCUS,
		);

		const adjacency = buildAdjacency(eligible, proximatePairs);
		const components = findConnectedComponents(eligible, adjacency);

		// Update cluster timers and fire callback when threshold met
		for (const component of components) {
			if (component.length < CLUSTER_MIN_SIZE) continue;
			const clusterKey = [...component].sort().join("|");
			if (this.clusterCooldowns.has(clusterKey)) continue;

			const elapsed = (this.clusterTimers.get(clusterKey) ?? 0) + deltaMs;
			this.clusterTimers.set(clusterKey, elapsed);

			if (elapsed >= CLUSTER_THRESHOLD_MS) {
				this.clusterTimers.delete(clusterKey);
				this.clusterCooldowns.set(clusterKey, CLUSTER_COOLDOWN_MS);
				this.clusterCallback?.(component.sort());
			}
		}

		// Clean up stale cluster timers for groups no longer proximate
		for (const [key] of this.clusterTimers) {
			const members = key.split("|");
			if (!isClusterStillTogether(members, eligible, proximatePairs)) {
				this.clusterTimers.delete(key);
			}
		}
	}

	private pickLine(domain: string, personality: readonly string[]): string {
		// 20% chance to use a personality quote
		if (personality.length > 0 && Math.random() < 0.2) {
			return personality[Math.floor(Math.random() * personality.length)];
		}
		// Use domain-specific lines, fall back to general
		const pool = CONVERSATION_LINES[domain] ?? CONVERSATION_LINES["general"];
		return pool[Math.floor(Math.random() * pool.length)];
	}
}
