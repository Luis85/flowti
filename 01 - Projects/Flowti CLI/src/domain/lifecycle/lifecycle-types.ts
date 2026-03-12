/**
 * lifecycle-types.ts — Type definitions for the lifecycle engine.
 */

import type { EntityType, LifecycleState, LifecycleTransitionRecord } from "../../infrastructure/types.js";

export interface LifecycleTemplate {
	entityType: EntityType;
	states: readonly string[];
	transitions: Record<string, readonly string[]>;
	initialState: string;
	terminalStates: readonly string[];
}

export interface LifecycleRecord {
	name: string;
	entityType: EntityType;
	currentState: LifecycleState;
	history: LifecycleTransitionRecord[];
	createdDate: string;
	lastTransitionDate: string;
	description: string;
}

export interface LifecycleSummary {
	name: string;
	entityType: EntityType;
	currentState: string;
	transitionCount: number;
	createdDate: string;
	file: string;
}

export interface TransitionResult {
	success: boolean;
	error?: string;
	from?: string;
	to?: string;
}
