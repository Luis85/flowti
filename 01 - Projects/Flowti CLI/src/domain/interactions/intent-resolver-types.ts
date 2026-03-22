import type { Interaction, InteractionPrerequisite, DayPhase } from "./interaction-types.js";

export interface IntentResolver {
	readonly entityType: string;
	resolve(): Interaction[];
}

export interface NPCInteractionRule {
	readonly npcRole: string;
	readonly trigger: "proximity" | "schedule" | "event" | "idle-timeout";
	readonly conditions: readonly InteractionPrerequisite[];
	readonly interaction: Partial<Interaction>;
	readonly weight: number;
	readonly cooldownMs: number;
}

export interface RoomInteractionRule {
	readonly roomType: string;
	readonly layer: "passive" | "reactive" | "active";
	readonly conditions: readonly EnvironmentCondition[];
	readonly interaction: Partial<Interaction>;
	readonly cooldownMs: number;
}

export type EnvironmentCondition =
	| { readonly type: "occupancy"; readonly op: ">" | "<" | "=="; readonly value: number }
	| { readonly type: "collective-mood"; readonly mood: string; readonly threshold: number }
	| { readonly type: "phase"; readonly phases: readonly DayPhase[] }
	| { readonly type: "event-recent"; readonly eventType: string; readonly withinMs: number }
	| { readonly type: "weather"; readonly weather: string };
