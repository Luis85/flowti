export { AgentSchema, type Agent } from './agent-schema.js';
export { TraitSchema, TraitEffectSchema, type Trait } from './trait-schema.js';
export {
	PositionSchema,
	MemoryEntrySchema,
	GoalSchema,
	SkillEntrySchema,
	InventoryItemSchema,
	EquipmentSchema,
	LLMConfigSchema,
} from './common.js';
export { GameConfigSchema, type GameConfig } from './game-config-schema.js';
export { LocationSchema, LOCATION_TYPES, type WorldLocation } from './location-schema.js';
export { BTNodeSchema, BehaviorTreeSchema, type BTNode, type BehaviorTree } from './behavior-tree-schema.js';
export * from './ranges.js';
