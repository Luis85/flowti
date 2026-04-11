import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { exchangeGossip, parseGossipData } from '../../domain/systems/gossip.js';
import type { GossipData, LocationGossip } from '../../domain/systems/gossip.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { MemoryComponent } from '../components/memory-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import type { MemoryEntry } from '../../domain/core/component-data.js';
import { pairKey } from '../../domain/core/math-utils.js';

function extractGossipFromMemory(entries: MemoryEntry[]): { memory: MemoryEntry; data: GossipData }[] {
	const result: { memory: MemoryEntry; data: GossipData }[] = [];
	for (const entry of entries) {
		const data = parseGossipData(entry);
		if (data !== null) {
			result.push({ memory: entry, data });
		}
	}
	return result;
}

function buildFirstHandLocationGossip(
	knownLocationIds: string[],
	locationList: WorldLocation[],
	agentId: string,
	currentTick: number,
): { memory: MemoryEntry; data: GossipData }[] {
	const result: { memory: MemoryEntry; data: GossipData }[] = [];

	for (const locId of knownLocationIds) {
		const loc = locationList.find(l => l.id === locId);
		if (loc === undefined) continue;

		const data: LocationGossip = {
			gossipType: 'location',
			locationId: loc.id,
			locationType: loc.facility_type ?? loc.type,
			position: { x: loc.position.x, y: loc.position.y },
			reliability: 1.0,
			sourceAgentId: agentId,
			hopCount: 0,
		};

		const memory: MemoryEntry = {
			tick: currentTick,
			type: 'gossip',
			description: `Heard from ${agentId}: there is a ${loc.facility_type ?? loc.type} at (${loc.position.x}, ${loc.position.y})`,
			participants: [agentId],
			outcome: 'neutral',
			significance: 5,
			mood_impact: 0,
			metadata: { ...data },
		};

		result.push({ memory, data });
	}

	return result;
}

function applyDispositionChanges(
	agent: AgentActor,
	changes: { agentId: string; change: number }[],
	tick: number,
): void {
	if (changes.length === 0) return;

	const relComp = agent.get(RelationshipComponent);

	let entries = relComp.state.entries.map(e => ({ ...e, tags: [...e.tags] }));

	for (const change of changes) {
		const existing = entries.find(e => e.agentId === change.agentId);
		if (existing !== undefined) {
			const result = applyRelationshipUpdate({
				currentDisposition: existing.disposition,
				currentFamiliarity: existing.familiarity,
				dispositionChange: change.change,
				familiarityChange: 0,
			});
			const newTags = existing.tags.includes('gossiped_about')
				? [...existing.tags]
				: [...existing.tags, 'gossiped_about'];
			entries = entries.map(e =>
				e.agentId === change.agentId
					? { ...e, disposition: result.newDisposition, familiarity: result.newFamiliarity, tags: newTags, lastInteractionTick: tick }
					: e,
			);
		} else {
			const result = applyRelationshipUpdate({
				currentDisposition: 0,
				currentFamiliarity: 0,
				dispositionChange: change.change,
				familiarityChange: 0,
			});
			entries = [
				...entries,
				{
					agentId: change.agentId,
					disposition: result.newDisposition,
					familiarity: result.newFamiliarity,
					tags: ['gossiped_about'],
					lastInteractionTick: tick,
				},
			];
		}
	}

	relComp.state = { ...relComp.state, entries };
	relComp.markDirty();
}

export function createGossipSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
): GameSystem {
	return {
		name: 'GossipSystem',
		priority: SystemPriority.GOSSIP,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const locationList = locations();
			const gossipConfig = deps.config.gossip;
			const processedPairs = new Set<string>();

			for (const agent of agentList) {
				const ba = agent.behaviorAgent;
				const partnerId = ba.gossipPending;
				if (partnerId === null) continue;

				const key = pairKey(agent.agentId, partnerId);
				if (processedPairs.has(key)) continue;
				processedPairs.add(key);

				const partner = agentList.find(a => a.agentId === partnerId);
				if (partner === undefined) continue;

				// Extract gossip for agent A (giver -> receiver B)
				const agentMem = agent.get(MemoryComponent);
				const agentKnownLocs = ba.knownLocations;
				const agentGossip = [
					...extractGossipFromMemory(agentMem.state.entries),
					...buildFirstHandLocationGossip(agentKnownLocs, locationList, agent.agentId, deps.tickCount),
				];

				// Extract gossip for partner B (giver -> receiver A)
				const partnerBa = partner.behaviorAgent;
				const partnerMem = partner.get(MemoryComponent);
				const partnerKnownLocs = partnerBa.knownLocations;
				const partnerGossip = [
					...extractGossipFromMemory(partnerMem.state.entries),
					...buildFirstHandLocationGossip(partnerKnownLocs, locationList, partner.agentId, deps.tickCount),
				];

				// Extract receiver gossip (what they already know — memory + first-hand locations)
				const agentReceiverGossip = [
					...extractGossipFromMemory(agentMem.state.entries),
					...buildFirstHandLocationGossip(agentKnownLocs, locationList, agent.agentId, deps.tickCount),
				];
				const partnerReceiverGossip = [
					...extractGossipFromMemory(partnerMem.state.entries),
					...buildFirstHandLocationGossip(partnerKnownLocs, locationList, partner.agentId, deps.tickCount),
				];

				// A->B: agent gives to partner
				const aToBResult = exchangeGossip({
					giverGossip: agentGossip,
					receiverGossip: partnerReceiverGossip,
					receiverIQ: partner.get(AttributesComponent).state.IQ,
					reliabilityTiers: gossipConfig.reliability_tiers,
					iqFilterThreshold: gossipConfig.iq_filter_threshold,
					minReliability: gossipConfig.min_reliability,
					maxItemsPerExchange: gossipConfig.max_items_per_exchange,
					currentTick: deps.tickCount,
				});

				// B->A: partner gives to agent
				const bToAResult = exchangeGossip({
					giverGossip: partnerGossip,
					receiverGossip: agentReceiverGossip,
					receiverIQ: agent.get(AttributesComponent).state.IQ,
					reliabilityTiers: gossipConfig.reliability_tiers,
					iqFilterThreshold: gossipConfig.iq_filter_threshold,
					minReliability: gossipConfig.min_reliability,
					maxItemsPerExchange: gossipConfig.max_items_per_exchange,
					currentTick: deps.tickCount,
				});

				// Write A->B gossip to partner's memory
				if (aToBResult.transferred.length > 0) {
					const newEntries = aToBResult.transferred.map(t => t.memory);
					partnerMem.state = {
						...partnerMem.state,
						entries: [...partnerMem.state.entries, ...newEntries],
					};
					partnerMem.markDirty();

					// Apply disposition changes on partner (receiver)
					for (const item of aToBResult.transferred) {
						applyDispositionChanges(partner, item.dispositionChanges, deps.tickCount);
					}
				}

				// Write B->A gossip to agent's memory
				if (bToAResult.transferred.length > 0) {
					const newEntries = bToAResult.transferred.map(t => t.memory);
					agentMem.state = {
						...agentMem.state,
						entries: [...agentMem.state.entries, ...newEntries],
					};
					agentMem.markDirty();

					// Apply disposition changes on agent (receiver)
					for (const item of bToAResult.transferred) {
						applyDispositionChanges(agent, item.dispositionChanges, deps.tickCount);
					}
				}

				// Collect gossip types for event
				const types = new Set<string>();
				for (const t of [...aToBResult.transferred, ...bToAResult.transferred]) {
					const meta = t.memory.metadata;
					if (meta !== undefined) {
						types.add(meta['gossipType'] as string);
					}
				}

				// Clear gossipPending on both agents
				ba.gossipPending = null;
				partnerBa.gossipPending = null;

				// Emit event
				deps.eventBus.emit({
					type: 'GossipExchanged',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'GossipSystem',
					payload: {
						agentAId: agent.agentId,
						agentBId: partner.agentId,
						aToB: aToBResult.transferred.length,
						bToA: bToAResult.transferred.length,
						types: [...types],
					},
				});
			}
		},
	};
}
