import { distance } from '../core/math-utils.js';

/**
 * Minimal structural shape a facility worker lookup needs from an agent.
 * Infrastructure types (e.g. AgentActor) satisfy this structurally so the
 * helper can stay inside the pure domain layer.
 */
export interface WorkerCandidate {
	agentId: string;
	job: string | null;
	pos: { x: number; y: number };
	behaviorAgent: { btAction: string | null };
}

/**
 * Look up the assigned worker for a facility. Returns the agent only when
 * all conditions hold: matching id, currently in the `work` action, correct
 * job, and within the facility radius. Otherwise returns undefined.
 */
export function findWorker<T extends WorkerCandidate>(
	agentList: T[],
	workerId: string | null,
	facilityJob: string,
	locX: number,
	locY: number,
	radius: number,
): T | undefined {
	if (workerId === null) return undefined;
	for (const agent of agentList) {
		if (agent.agentId !== workerId) continue;
		if (agent.behaviorAgent.btAction !== 'work') return undefined;
		if (agent.job !== facilityJob) return undefined;
		const dist = distance(agent.pos.x, agent.pos.y, locX, locY);
		if (dist > radius) return undefined;
		return agent;
	}
	return undefined;
}
