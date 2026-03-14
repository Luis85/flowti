/**
 * iteration-types.ts — Type definitions for iteration management.
 *
 * Iterations are timeboxed containers for producing increments.
 * Each iteration produces two files: a plan and a report.
 */

import type { IterationStatus } from "../../infrastructure/types.js";

export interface AgentReference {
	name: string;
	file: string;
}

export interface ResourceAllocation {
	name: string;
	role?: string;
	allocation?: string;
}

export interface CapacityEntry {
	label: string;
	value: string;
	unit?: string;
}

export interface IterationDefinition {
	name: string;
	number: number;
	startDate: string;
	endDate: string;
	goal: string;
	capacity?: string;
	description?: string;
	agents?: AgentReference[];
	resources?: ResourceAllocation[];
	capacities?: CapacityEntry[];
}

export interface ScopeItem {
	text: string;
	done: boolean;
}

export interface IterationSummary {
	name: string;
	number: number;
	startDate: string;
	endDate: string;
	goal: string;
	capacity: string;
	description: string;
	status: IterationStatus;
	file: string;
	agents: AgentReference[];
	resources: ResourceAllocation[];
	capacities: CapacityEntry[];
	scopeItems: ScopeItem[];
}
