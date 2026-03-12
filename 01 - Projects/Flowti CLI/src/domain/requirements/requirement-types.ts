/**
 * requirement-types.ts — Type definitions for IREB-compliant requirements management.
 */

import type { RequirementType, MoSCoWPriority } from "../../infrastructure/types.js";

export type RequirementStatus = "draft" | "proposed" | "approved" | "implemented" | "verified" | "rejected" | "deferred";
export type UserStoryStatus = "backlog" | "ready" | "in-progress" | "done";

export interface RequirementDefinition {
	name: string;
	requirementType: RequirementType;
	id: string;
	status: RequirementStatus;
	priority: MoSCoWPriority;
	category?: "security" | "performance" | "usability" | "reliability" | "maintainability";
	source?: string;
	rationale?: string;
	acceptanceCriteria?: string[];
	linkedUseCases?: string[];
	linkedUserStories?: string[];
	description: string;
}

export interface RequirementSummary {
	name: string;
	id: string;
	requirementType: RequirementType;
	status: string;
	priority: string;
	file: string;
}

export interface UseCaseDefinition {
	name: string;
	id: string;
	actor: string;
	preconditions?: string[];
	postconditions?: string[];
	linkedRequirements?: string[];
	description: string;
}

export interface UseCaseSummary {
	name: string;
	id: string;
	actor: string;
	file: string;
}

export interface UserStoryDefinition {
	name: string;
	id: string;
	role: string;
	goal: string;
	benefit: string;
	storyPoints?: number;
	status: UserStoryStatus;
	linkedRequirements?: string[];
	description: string;
}

export interface UserStorySummary {
	name: string;
	id: string;
	role: string;
	status: string;
	storyPoints: number;
	file: string;
}
