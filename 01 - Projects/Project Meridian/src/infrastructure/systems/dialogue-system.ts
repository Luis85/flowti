import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { selectDialogue } from '../../domain/systems/dialogue.js';
import { applyRelationshipUpdate } from '../../domain/systems/relationship.js';
import { createGameRNG, hashString } from '../../domain/core/game-rng.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';

function pairKey(a: string, b: string): string {
	return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function createDialogueSystem(
	agents: () => AgentActor[],
	baseSeed: number,
): GameSystem {
	return {
		name: 'DialogueSystem',
		priority: SystemPriority.DIALOGUE,

		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const agentMap = new Map<string, AgentActor>();
			for (const a of agentList) {
				agentMap.set(a.agentId, a);
			}

			// Read SocialInteraction events from this tick
			const socialEvents = deps.eventBus.history({ type: 'SocialInteraction' })
				.filter(e => e.tick === deps.tickCount);

			for (const event of socialEvents) {
				const payload = event.payload as {
					agentId: string;
					partnerId: string;
					memoryCreated: boolean;
				};

				// Cooldown filter: skip when no memory was created (on cooldown)
				if (!payload.memoryCreated) continue;

				const agent = agentMap.get(payload.agentId);
				const partner = agentMap.get(payload.partnerId);
				if (agent === undefined || partner === undefined) continue;

				const key = pairKey(agent.agentId, partner.agentId);
				const rng = createGameRNG((baseSeed ^ deps.tickCount ^ hashString(key)) >>> 0);

				const agentMood = agent.get(MoodComponent);
				const partnerMood = partner.get(MoodComponent);

				// Read relationship data
				const agentRelComp = agent.get(RelationshipComponent);
				const partnerRelComp = partner.get(RelationshipComponent);

				const agentRel = agentRelComp.state.entries.find(e => e.agentId === partner.agentId);
				const partnerRel = partnerRelComp.state.entries.find(e => e.agentId === agent.agentId);

				const disposition = agentRel?.disposition ?? 0;
				const partnerDisposition = partnerRel?.disposition ?? 0;
				const familiarity = agentRel?.familiarity ?? 0;

				const result = selectDialogue({
					agentKind: agent.kind,
					agentName: agent.agentName,
					agentMoodBucket: agentMood.state.bucket,
					partnerKind: partner.kind,
					partnerName: partner.agentName,
					partnerMoodBucket: partnerMood.state.bucket,
					disposition,
					partnerDisposition,
					familiarity,
					gossipFamiliarityThreshold: deps.config.gossip.familiarity_threshold,
					rng,
				});

				// Memory replacement: find and replace the social memory from this tick
				replaceMemory(agent, partner.agentId, deps.tickCount, result.agentLine, result.tone);
				replaceMemory(partner, agent.agentId, deps.tickCount, result.partnerLine, result.tone);

				// Disposition update for both agents
				updateRelationship(agent, partner.agentId, disposition, familiarity, result.dispositionChange, deps.tickCount);
				updateRelationship(partner, agent.agentId, partnerDisposition, partnerRel?.familiarity ?? 0, result.dispositionChange, deps.tickCount);

				// Gossip gate
				if (result.shouldExchangeGossip) {
					const agentBb = agent.get(BlackboardComponent);
					agentBb.state = { ...agentBb.state, gossipPending: partner.agentId };
					agentBb.markDirty();

					const partnerBb = partner.get(BlackboardComponent);
					partnerBb.state = { ...partnerBb.state, gossipPending: agent.agentId };
					partnerBb.markDirty();
				}

				// Emit DialogueCompleted
				deps.eventBus.emit({
					type: 'DialogueCompleted',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'DialogueSystem',
					payload: {
						agentId: agent.agentId,
						partnerId: partner.agentId,
						tone: result.tone,
						agentLine: result.agentLine,
						partnerLine: result.partnerLine,
					},
				});
			}
		},
	};
}

function replaceMemory(
	actor: AgentActor,
	partnerId: string,
	tick: number,
	description: string,
	tone: 'positive' | 'negative' | 'neutral',
): void {
	const memComp = actor.get(MemoryComponent);
	const moodImpact = tone === 'positive' ? 2 : tone === 'negative' ? -2 : 0;
	const outcome = tone === 'negative' ? 'negative' as const : tone === 'positive' ? 'positive' as const : 'neutral' as const;

	// Remove the social memory from this tick for this partner
	const filtered = memComp.state.entries.filter(
		m => !(m.type === 'social' && m.tick === tick && m.participants.includes(partnerId)),
	);

	// Add dialogue memory
	const dialogueMemory = {
		tick,
		type: 'dialogue' as const,
		description,
		participants: [partnerId],
		outcome,
		significance: 3,
		mood_impact: moodImpact,
	};

	memComp.state = {
		...memComp.state,
		entries: [...filtered, dialogueMemory],
	};
	memComp.markDirty();
}

function updateRelationship(
	actor: AgentActor,
	partnerId: string,
	currentDisposition: number,
	currentFamiliarity: number,
	dispositionChange: number,
	tickCount: number,
): void {
	const relComp = actor.get(RelationshipComponent);
	const existingRel = relComp.state.entries.find(e => e.agentId === partnerId);

	const updated = applyRelationshipUpdate({
		currentDisposition: existingRel?.disposition ?? currentDisposition,
		currentFamiliarity: existingRel?.familiarity ?? currentFamiliarity,
		dispositionChange,
		familiarityChange: 0,
	});

	const existingTags = existingRel?.tags ?? [];
	const newEntry = {
		agentId: partnerId,
		disposition: updated.newDisposition,
		familiarity: updated.newFamiliarity,
		tags: existingTags.includes('talked_with') ? [...existingTags] : [...existingTags, 'talked_with'],
		lastInteractionTick: tickCount,
	};

	const updatedEntries = existingRel !== undefined
		? relComp.state.entries.map(e => e.agentId === partnerId ? newEntry : { ...e })
		: [...relComp.state.entries.map(e => ({ ...e })), newEntry];

	relComp.state = { ...relComp.state, entries: updatedEntries };
	relComp.markDirty();
}
