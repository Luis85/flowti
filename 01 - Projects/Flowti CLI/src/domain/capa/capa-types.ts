/**
 * capa-types.ts — Type definitions for CAPA (Corrective and Preventive Action) management.
 */

import type { CAPAType, CAPAStatus } from "../../infrastructure/types.js";

export type CAPASeverity = "critical" | "high" | "medium" | "low";
export type CAPASource = "audit" | "complaint" | "incident" | "observation" | "review" | "other";

export interface CAPADefinition {
	name: string;
	capaType: CAPAType;
	status: CAPAStatus;
	severity: CAPASeverity;
	source: CAPASource;
	owner?: string;
	dueDate?: string;
	rootCause?: string;
	description: string;
}

export interface CAPASummary {
	name: string;
	id: string;
	capaType: CAPAType;
	status: CAPAStatus;
	severity: string;
	source: string;
	owner: string;
	dueDate: string;
	file: string;
}
