/**
 * resource-types.ts — Type definitions for project resource management.
 */

import type { ResourceType } from "../../infrastructure/types.js";

export interface ResourceDefinition {
	name: string;
	resourceType: ResourceType;
	/** Role name — for human resources. */
	role?: string;
	/** Unit price (e.g., cost per hour, per unit). */
	price: number;
	/** Price unit — "hour" | "day" | "unit" (default: "hour"). */
	priceUnit?: string;
	/** Hourly rate — for role type resources. */
	hourlyRate?: number;
	/** Quantity: FTE for roles/humans, count for material. */
	amount: number;
	/** Consumed quantity so far. */
	consumed: number;
	status: string;
	description: string;
}

export interface ResourceSummary {
	name: string;
	resourceType: ResourceType;
	price: number;
	amount: number;
	consumed: number;
	remaining: number;
	totalCost: number;
	consumedCost: number;
	file: string;
}

export interface FinancialSummary {
	totalBudget: number;
	totalConsumed: number;
	totalRemaining: number;
	byType: Record<ResourceType, { budget: number; consumed: number }>;
	burnRate: number;
}
