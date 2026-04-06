import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { applyLeisureTick } from '../../domain/systems/leisure.js';
import type { Actor } from 'excalibur';

export function createLeisureSystem(
	agents: () => AgentActor[],
	locations: () => WorldLocation[],
	worldEntity: () => Actor,
	getLocationActors?: () => Map<string, Actor>,
): GameSystem {
	const activeLeisure = new Map<string, string>();

	return {
		name: 'LeisureSystem',
		priority: SystemPriority.LEISURE,

		execute(deps: GameCoreDeps): void {
			const locationList = locations();
			const locationActors = getLocationActors?.() ?? new Map<string, Actor>();

			for (const agent of agents()) {
				const ba = agent.behaviorAgent;
				const btAction = ba.btAction;

				if (btAction !== 'leisure') {
					if (activeLeisure.has(agent.agentId)) {
						deps.eventBus.emit({
							type: 'LeisureComplete',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'LeisureSystem',
							payload: {
								agentId: agent.agentId,
								locationId: activeLeisure.get(agent.agentId),
							},
						});
						activeLeisure.delete(agent.agentId);
					}
					continue;
				}

				const targetId = ba.leisureTarget;
				if (targetId === null) continue;

				const loc = locationList.find(l => l.id === targetId);
				if (loc?.leisure === null || loc?.leisure === undefined) continue;
				const leisure = loc.leisure;

				const previousTarget = activeLeisure.get(agent.agentId);
				if (previousTarget !== targetId) {
					activeLeisure.set(agent.agentId, targetId);

					// Deduct cost on first tick
					if (leisure.cost > 0) {
						const wallet = agent.get(WalletComponent);
						wallet.state = { ...wallet.state, gold: wallet.state.gold - leisure.cost };
						wallet.markDirty();

						// Credit facility fund
						const locActor = locationActors.get(targetId);
						if (locActor?.has(FacilityComponent) === true) {
							const facility = locActor.get(FacilityComponent);
							facility.state = { ...facility.state, fund: facility.state.fund + leisure.cost };
							facility.markDirty();
						}

						// Append LedgerEntry (matches RestSystem pattern)
						const world = worldEntity();
						const economy = world.get(EconomyComponent);
						economy.state = {
							...economy.state,
							ledger: [
								...economy.state.ledger,
								{
									tick: deps.tickCount,
									type: 'purchase' as const,
									from: agent.agentId,
									to: targetId,
									itemId: null,
									quantity: 0,
									gold: leisure.cost,
								},
							],
						};
						economy.markDirty();

						// Emit GoldFlowed for monetary policy
						deps.eventBus.emit({
							type: 'GoldFlowed',
							tick: deps.tickCount,
							wallClock: Date.now(),
							source: 'LeisureSystem',
							payload: {
								category: 'transfer' as const,
								subcategory: 'leisure',
								amount: leisure.cost,
								fromEntity: agent.agentId,
								toEntity: targetId,
							},
						});
					}

					// Skill XP on first tick only
					if (leisure.effects.skill_xp > 0) {
						const skills = ba.skills;
						const existing = skills.find(s => s.id === 'study');
						if (existing !== undefined) {
							existing.points += leisure.effects.skill_xp;
						} else {
							skills.push({ id: 'study', points: leisure.effects.skill_xp, use_count: 0, use_bonus: 0 });
						}
					}

					// Positive memory for mood effect (uses existing memory→mood pipeline)
					if (leisure.effects.mood > 0) {
						const memComp = agent.get(MemoryComponent);
						memComp.state = {
							...memComp.state,
							entries: [
								...memComp.state.entries,
								{
									tick: deps.tickCount,
									type: `leisure_${loc.id}`,
									description: `Enjoyed leisure at ${loc.name}`,
									participants: [],
									outcome: 'positive' as const,
									significance: Math.ceil(leisure.effects.mood / 2),
									mood_impact: leisure.effects.mood,
								},
							],
						};
						memComp.markDirty();
					}

					deps.eventBus.emit({
						type: 'LeisureStarted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'LeisureSystem',
						payload: {
							agentId: agent.agentId,
							locationId: targetId,
							locationName: loc.name,
							cost: leisure.cost,
						},
					});
				}

				// Per-tick effects (gradual application via domain pure function)
				const needs = agent.get(NeedsComponent);
				const result = applyLeisureTick({
					currentSocial: needs.state.social,
					currentEnergy: needs.state.energy,
					effects: leisure.effects,
					ticksPerVisit: leisure.ticks_per_visit,
				});
				if (result.newSocial !== needs.state.social || result.newEnergy !== needs.state.energy) {
					needs.state = { ...needs.state, social: result.newSocial, energy: result.newEnergy };
					needs.markDirty();
				}
			}
		},
	};
}
