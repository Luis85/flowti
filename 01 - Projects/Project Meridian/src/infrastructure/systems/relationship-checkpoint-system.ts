import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { AgentActor } from '../entity/agent-actor.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import {
	serializeRelationshipGraph,
	serializeAgentRelationshipView,
	type RelationshipGraphInput,
} from '../../domain/systems/relationship-canvas.js';

const GRAPH_PATH = '03 - Resources/Graphs/relationships.canvas';

function collectGraphInput(agentList: AgentActor[]): RelationshipGraphInput {
	const agents = agentList.map(a => ({
		id: a.agentId,
		name: a.agentName,
		kind: a.kind,
		color: a.agentColor,
	}));

	const relationships = agentList.map(a => ({
		agentId: a.agentId,
		entries: [...a.get(RelationshipComponent).state.entries],
	}));

	return { agents, relationships };
}

export function createRelationshipCheckpointSystem(
	agents: () => AgentActor[],
): GameSystem {
	let ticksSinceCheckpoint = 0;

	return {
		name: 'RelationshipCheckpointSystem',
		priority: SystemPriority.VAULT_SYNC,

		execute(deps: GameCoreDeps): void {
			ticksSinceCheckpoint++;

			const interval = deps.config.canvas_checkpoint_interval_ticks;
			const checkpointReached = ticksSinceCheckpoint >= interval;

			// Handle on-demand per-agent relationship view requests
			const viewRequests = deps.eventBus.history({
				type: 'RequestAgentRelationshipView',
			}).filter(e => e.tick === deps.tickCount);

			const hasViewRequests = viewRequests.length > 0;

			// Compute graph input once if either branch needs it
			if (!checkpointReached && !hasViewRequests) return;

			const agentList = agents();
			const input = collectGraphInput(agentList);

			if (checkpointReached) {
				ticksSinceCheckpoint = 0;

				const content = serializeRelationshipGraph(input);

				// Count edges for the event payload
				const parsed = JSON.parse(content) as { edges: unknown[] };
				const edgeCount = parsed.edges.length;

				if (deps.writeFile !== null) {
					void deps.writeFile(GRAPH_PATH, content);
				}

				deps.eventBus.emit({
					type: 'RelationshipGraphCheckpointed',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'RelationshipCheckpointSystem',
					payload: {
						tickCount: deps.tickCount,
						agentCount: agentList.length,
						edgeCount,
						path: GRAPH_PATH,
					},
				});
			}

			if (hasViewRequests) {
				for (const request of viewRequests) {
					const requestedAgentId = request.payload.agentId as string;
					const agent = agentList.find(a => a.agentId === requestedAgentId);
					if (agent === undefined) continue;

					const viewContent = serializeAgentRelationshipView(requestedAgentId, input);
					const viewPath = `03 - Resources/Graphs/${agent.agentName}-relationships.canvas`;

					if (deps.writeFile !== null) {
						void deps.writeFile(viewPath, viewContent);
					}
				}
			}
		},
	};
}
