/**
 * deliverable-types.ts — Type definitions for project deliverables.
 */

import type { DeliverableStatus } from "../../infrastructure/types.js";

export interface DeliverableDefinition {
	name: string;
	status: DeliverableStatus;
	dueDate?: string;
	assignee?: string;
	priority?: string;
	completionPct?: number;
	description: string;
}

export interface DeliverableSummary {
	name: string;
	status: DeliverableStatus;
	dueDate: string;
	assignee: string;
	completionPct: number;
	file: string;
}
