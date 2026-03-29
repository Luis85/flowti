import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { applySocialize } from '../../domain/systems/socialize.js';
import { AGENT_SOCIAL_ACTIONS } from '../../domain/systems/bt-actions.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { NeedsComponent } from '../components/needs-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { PerceptionComponent } from '../components/perception-component.js';

function pairKey(a: string, b: string): string {
	return a < b ? `${a}:${b}` : `${b}:${a}`;
}

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

			for (const agent of agentList) {
				const bb = agent.get(BlackboardComponent);
				const btAction = bb.state.btAction as string | undefined;

				if (btAction === undefined || !AGENT_SOCIAL_ACTIONS.has(btAction)) continue;

				// Find nearest agent within interaction radius using PerceptionComponent
				const perception = agent.get(PerceptionComponent);
				const nearbyAgent = perception.state.nearbyAgents.find(a => a.distance <= radius);
				if (nearbyAgent === undefined) continue;

				// Skip if this pair already processed this tick
				const key = pairKey(agent.agentId, nearbyAgent.id);
				if (processedPairs.has(key)) continue;
				processedPairs.add(key);

				// Find the partner AgentActor
				const partner = agentList.find(a => a.agentId === nearbyAgent.id);
				if (partner === undefined) continue;

				// Read cooldown for this pair
				const cooldownKey = `lastSocial_${nearbyAgent.id}`;
				const lastSocialTick = (bb.state[cooldownKey] as number | undefined) ?? null;

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
					lastSocialTick,
				}, socialConfig);
				partnerNeeds.state = { ...partnerNeeds.state, social: partnerResult.newSocial };
				partnerNeeds.markDirty();

				// If memory returned (not on cooldown): append to both agents
				if (result.memory !== null) {
					const agentMem = agent.get(MemoryComponent);
					agentMem.state.entries.push(result.memory);
					agentMem.markDirty();

					// Partner gets a reciprocal memory (from partnerResult)
					if (partnerResult.memory !== null) {
						const partnerMem = partner.get(MemoryComponent);
						partnerMem.state.entries.push(partnerResult.memory);
						partnerMem.markDirty();
					}

					// Update cooldown for both
					bb.state[cooldownKey] = deps.tickCount;
					bb.markDirty();

					const partnerBb = partner.get(BlackboardComponent);
					partnerBb.state[`lastSocial_${agent.agentId}`] = deps.tickCount;
					partnerBb.markDirty();
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
