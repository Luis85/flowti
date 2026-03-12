/**
 * raid-types.ts — Type definitions for RAID log management.
 */

import type { RAIDItemType, RAIDStatus } from "../../infrastructure/types.js";

export interface RAIDDefinition {
	name: string;
	itemType: RAIDItemType;
	status: RAIDStatus;
	severity: "critical" | "high" | "medium" | "low";
	owner?: string;
	dueDate?: string;
	category?: "technical" | "business" | "organizational" | "external";
	description: string;
}

export interface RAIDSummary {
	name: string;
	itemType: RAIDItemType;
	status: RAIDStatus;
	severity: string;
	owner: string;
	dueDate: string;
	file: string;
}
