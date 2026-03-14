/**
 * lifecycle-types.ts — Type definitions for the lifecycle engine.
 */

import type { EntityType, LifecycleState, LifecycleTransitionRecord } from "../../infrastructure/types.js";

// ── Gate types ──────────────────────────────────────────────────────

export interface GateDefinition {
	id: string;
	label: string;
}

export interface GateResult {
	gateId: string;
	passed: boolean;
	message?: string;
}

// ── Template ────────────────────────────────────────────────────────

export interface LifecycleTemplate {
	entityType: string;
	states: readonly string[];
	transitions: Record<string, readonly string[]>;
	initialState: string;
	terminalStates: readonly string[];
	labels?: Record<string, string>;
	gates?: Record<string, readonly GateDefinition[]>;
}

// ── Transition results ──────────────────────────────────────────────

export interface TransitionResult {
	success: boolean;
	error?: string;
	from?: string;
	to?: string;
}

export interface GatedTransitionResult extends TransitionResult {
	gateResults?: GateResult[];
}

// ── Store records ───────────────────────────────────────────────────

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
