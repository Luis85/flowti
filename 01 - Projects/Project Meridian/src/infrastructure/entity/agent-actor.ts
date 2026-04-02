import { Actor, Circle, Color, Label, Font, FontUnit, vec } from 'excalibur';
import type { Agent } from '../../domain/schemas/agent-schema.js';
import type { BehaviorAgent } from '../../domain/systems/behavior-agent.js';
import type { BehaviourTree } from 'mistreevous';
import { NeedsComponent } from '../components/needs-component.js';
import { MoodComponent } from '../components/mood-component.js';
import { MemoryComponent } from '../components/memory-component.js';
import { AttributesComponent } from '../components/attributes-component.js';
import { SocialComponent } from '../components/social-component.js';
import { TraitsComponent } from '../components/traits-component.js';
import { WalletComponent } from '../components/wallet-component.js';
import { InventoryComponent } from '../components/inventory-component.js';
import { RelationshipComponent } from '../components/relationship-component.js';
import { StaminaComponent } from '../components/stamina-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { calculateMood } from '../../domain/systems/mood.js';
import type { MoodConfig } from '../../domain/systems/mood.js';

export class AgentActor extends Actor {
	readonly agentId: string;
	readonly agentName: string;
	readonly kind: string;
	readonly behaviorTreeDef: string;
	readonly property: string[];
	job: string | null;
	readonly agentColor: string;
	behaviorAgent!: BehaviorAgent;
	behaviorTree!: BehaviourTree;

	constructor(agent: Agent, moodConfig: MoodConfig, memoryMaxEntries = 50) {
		super({ x: agent.position.x, y: agent.position.y });

		this.agentId = agent.id;
		this.agentName = agent.name;
		this.kind = agent.kind;
		this.behaviorTreeDef = agent.behavior_tree;
		this.property = [...agent.property];
		this.job = agent.job ?? null;
		this.agentColor = agent.color;

		this.addComponent(new NeedsComponent({ ...agent.needs }));

		// Bootstrap mood from needs — agent.mood (number) is discarded
		const needsSatisfaction = (agent.needs.hunger + agent.needs.energy + agent.needs.social + agent.needs.thirst) / 400;
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
		this.addComponent(new AttributesComponent({ ...agent.attributes }));
		this.addComponent(new SocialComponent({ ...agent.social }));
		this.addComponent(new TraitsComponent([...agent.traits]));
		this.addComponent(new WalletComponent({ gold: agent.wallet.gold }));
		this.addComponent(new InventoryComponent({
			items: agent.inventory.map(i => ({ item_id: i.item_id, quantity: i.quantity, ...(i.charges !== undefined ? { charges: i.charges } : {}) })),
		}));
		this.addComponent(new RelationshipComponent({ entries: [] }));
		this.addComponent(new StaminaComponent({ current: agent.attributes.HT, max: agent.attributes.HT }));
		this.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));

		// Placeholder visuals — colored circle + name label (color from agent data)
		this.graphics.use(new Circle({ radius: 14, color: Color.fromHex(agent.color) }));

		const label = new Label({
			text: agent.name,
			pos: vec(0, -22),
			font: new Font({ size: 11, unit: FontUnit.Px, color: Color.White }),
		});
		this.addChild(label);
	}
}
