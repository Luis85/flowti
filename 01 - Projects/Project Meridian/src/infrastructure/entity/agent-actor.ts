import { Actor } from 'excalibur';
import type { Agent } from '../../domain/schemas/agent-schema.js';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { BlackboardComponent } from '../components/blackboard-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { SocialComponent } from '../components/social-component.js';
import { TraitsComponent } from '../components/traits-component.js';
import { calculateMood } from '../../domain/systems/mood.js';
import type { MoodConfig } from '../../domain/systems/mood.js';

export class AgentActor extends Actor {
	readonly agentId: string;
	readonly agentName: string;
	readonly kind: string;

	constructor(agent: Agent, moodConfig: MoodConfig, memoryMaxEntries = 50) {
		super({ x: agent.position.x, y: agent.position.y });

		this.agentId = agent.id;
		this.agentName = agent.name;
		this.kind = agent.kind;

		this.addComponent(new NeedsComponent({ ...agent.needs }));

		// Bootstrap mood from needs — agent.mood (number) is discarded
		const needsSatisfaction = (agent.needs.hunger + agent.needs.energy + agent.needs.social) / 300;
		const initialMood = calculateMood(
			{
				needsSatisfaction,
				positiveMemories: 0,
				negativeMemories: 0,
				goalProgress: 0,
				walletHealth: 0,
				equipmentCondition: 0,
				relationshipQuality: 0,
			},
			'',
			moodConfig,
			0,
		);
		this.addComponent(new MoodComponent({ value: initialMood.value, bucket: initialMood.bucket }));

		this.addComponent(new MemoryComponent({
			entries: agent.memory.map(m => ({ ...m })),
			maxEntries: memoryMaxEntries,
		}));
		this.addComponent(new BlackboardComponent({}));
		this.addComponent(new AttributesComponent({ ...agent.attributes }));
		this.addComponent(new SocialComponent({ ...agent.social }));
		this.addComponent(new TraitsComponent([...agent.traits]));
	}
}
