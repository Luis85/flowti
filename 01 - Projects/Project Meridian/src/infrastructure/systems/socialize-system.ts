import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applySocialize } from '../../domain/systems/socialize.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { pairKey } from '../../domain/core/math-utils.js';

export function createSocializeSystem(
	agents: () => AgentActor[],
): GameSystem {
	return {
		name: 'SocializeSystem',
		priority: SystemPriority.SOCIALIZE,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const radius = deps.config.perception.interaction_radius;
			const socialConfig = deps.config.social;
			const processedPairs = new Set<string>();

			// Passive social recovery from nearby agents (ambient proximity)
			const passiveRecovery = 0.3;
			for (const agent of agentList) {
				const perception = agent.get(PerceptionComponent);
				const hasNearbyAgent = perception.state.nearbyAgents.some(a => a.distance < radius);
				if (!hasNearbyAgent) continue;

				const needs = agent.get(NeedsComponent);
				if (needs.state.social < 100) {
					needs.state = { ...needs.state, social: Math.min(100, needs.state.social + passiveRecovery) };
					needs.markDirty();
				}
			}

			// Active socialization — requires 'talk' action
			for (const agent of agentList) {
				const ba = agent.behaviorAgent;
				const btAction = ba.btAction;

				if (btAction !== 'talk') continue;

				// Find nearest agent within interaction radius using PerceptionComponent
				const perception = agent.get(PerceptionComponent);
				const nearbyAgent = perception.state.nearbyAgents.find(a => a.distance <= radius);
				if (nearbyAgent === undefined) continue;

				// Skip if this pair already processed this tick
				const key = pairKey(agent.agentId, nearbyAgent.id);
				if (processedPairs.has(key)) continue;
				processedPairs.add(key);

				// Find the partner AgentActor — partner must be available (not in intense activity)
				const partner = agentList.find(a => a.agentId === nearbyAgent.id);
				if (partner === undefined) continue;
				const partnerBtAction = partner.behaviorAgent.btAction;
				const socialReceptive = partnerBtAction === null || partnerBtAction === 'talk' || partnerBtAction === 'idle' || partnerBtAction === 'wander' || partnerBtAction === 'rest' || partnerBtAction === 'seek_social';
				if (!socialReceptive) continue;

				// Read cooldown for this pair
				const lastSocialTick = ba.socialCooldowns.get(nearbyAgent.id) ?? null;

				// Read partner's own cooldown separately
				const partnerBa = partner.behaviorAgent;
				const partnerLastSocialTick = partnerBa.socialCooldowns.get(agent.agentId) ?? null;

				// Apply socialization for initiating agent
				const result = applySocialize({
					agentId: agent.agentId,
					agentName: agent.agentName,
					partnerId: partner.agentId,
					partnerName: partner.agentName,
					currentSocial: agent.get(NeedsComponent).state.social,
					currentTick: deps.tickCount,
					lastSocialTick,
				}, socialConfig);

				// Update initiating agent's social need
				const agentNeeds = agent.get(NeedsComponent);
				agentNeeds.state = { ...agentNeeds.state, social: result.newSocial };
				agentNeeds.markDirty();

				// Also recover partner's social
				const partnerNeeds = partner.get(NeedsComponent);
				const partnerResult = applySocialize({
					agentId: partner.agentId,
					agentName: partner.agentName,
					partnerId: agent.agentId,
					partnerName: agent.agentName,
					currentSocial: partnerNeeds.state.social,
					currentTick: deps.tickCount,
					lastSocialTick: partnerLastSocialTick,
				}, socialConfig);
				partnerNeeds.state = { ...partnerNeeds.state, social: partnerResult.newSocial };
				partnerNeeds.markDirty();

				// If memory returned (not on cooldown): append to both agents
				if (result.memory !== null) {
					const agentMem = agent.get(MemoryComponent);
					agentMem.state = {
						...agentMem.state,
						entries: [...agentMem.state.entries, result.memory],
					};
					agentMem.markDirty();

					// Partner gets a reciprocal memory (from partnerResult)
					if (partnerResult.memory !== null) {
						const partnerMem = partner.get(MemoryComponent);
						partnerMem.state = {
							...partnerMem.state,
							entries: [...partnerMem.state.entries, partnerResult.memory],
						};
						partnerMem.markDirty();
					}

					// Update cooldown for both
					ba.socialCooldowns.set(nearbyAgent.id, deps.tickCount);
					partnerBa.socialCooldowns.set(agent.agentId, deps.tickCount);
				}

				// Emit event
				deps.eventBus.emit({
					type: 'SocialInteraction',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'SocializeSystem',
					payload: {
						agentId: agent.agentId,
						partnerId: partner.agentId,
						memoryCreated: result.memory !== null,
					},
				});
			}
		},
	};
}
