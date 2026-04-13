import type { WorkingMemory } from './bt-working-memory.js';
import type { BehaviorAgentDeps } from './behavior-agent-factory.js';
import type { AgentActor } from './agent-actor.js';
import type { ActionResult, PerceivedFacility, PerceivedAgent, PerceivedLocation } from '../../domain/systems/behavior-agent.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

export const SUCCEEDED: ActionResult = 'mistreevous.succeeded';
export const FAILED: ActionResult = 'mistreevous.failed';
export const RUNNING: ActionResult = 'mistreevous.running';

/** Shared context for action sub-modules. */
export interface ActionContext {
	memory: WorkingMemory;
	actor: AgentActor;
	deps: BehaviorAgentDeps;
	resolveNearbyFacilities: () => PerceivedFacility[];
	resolveNearbyAgents: () => PerceivedAgent[];
	resolveNearbyLocations: () => PerceivedLocation[];
	commitmentMultiplier: number;
}

/**
 * Extended context for condition sub-modules (Chunk 5 will use this).
 */
export interface ConditionContext extends ActionContext {
	getAtLocationData: () => WorldLocation | undefined;
	wakeOffset: number;
	personalSleepOffset: number;
}

export function beginAction(ctx: ActionContext, actionName: string): void {
	const { memory, commitmentMultiplier } = ctx;
	const { config } = ctx.deps;
	memory.btAction = actionName;
	// If a different action overrides an existing commitment (e.g., P0 critical needs
	// preempting P-1), clear the stale commitment so the new action owns the timer.
	if (memory.commitmentTicks > 0 && memory.committedAction !== actionName) {
		ctx.deps.eventBus.emit({
			type: 'CommitmentChanged',
			tick: ctx.deps.tickCount(),
			wallClock: Date.now(),
			source: 'beginAction',
			payload: {
				agentId: ctx.actor.agentId,
				event: 'broken',
				action: memory.committedAction ?? actionName,
				reason: 'higher_priority',
				ticksRemaining: memory.commitmentTicks,
			},
		});
		memory.commitmentTicks = 0;
		memory.committedAction = null;
	}
	if (memory.commitmentTicks <= 0) {
		const duration = Math.round((config.commitment_ticks[actionName] ?? 0) * commitmentMultiplier);
		if (duration > 0) {
			memory.commitmentTicks = duration;
			memory.committedAction = actionName;
			ctx.deps.eventBus.emit({
				type: 'CommitmentChanged',
				tick: ctx.deps.tickCount(),
				wallClock: Date.now(),
				source: 'beginAction',
				payload: {
					agentId: ctx.actor.agentId,
					event: 'created',
					action: actionName,
					ticksRemaining: duration,
				},
			});
		}
	}
}
