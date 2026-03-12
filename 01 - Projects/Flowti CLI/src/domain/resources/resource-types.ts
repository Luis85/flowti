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
	/** Budget category (e.g., "development", "infrastructure"). Budget type only. */
	category?: string;
	/** Budget period start date (ISO). Budget type only. */
	periodStart?: string;
	/** Budget period end date (ISO). Budget type only. */
	periodEnd?: string;
	/** Currency code (e.g., "EUR", "USD"). Budget type only. */
	currency?: string;
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

// ── Planning types (data model only — no store/menu yet) ────────────

/** Planned allocation of a resource to a deliverable or task. */
export interface ResourceAllocation {
	resourceName: string;
	deliverableName?: string;
	task?: string;
	/** Allocation percentage (0–100). */
	allocationPct: number;
	startDate: string;
	endDate: string;
	plannedHours: number;
	status: "planned" | "active" | "completed" | "cancelled";
}

/** Availability window for a resource. */
export interface ResourceAvailability {
	resourceName: string;
	startDate: string;
	endDate: string;
	hoursPerDay: number;
	notes?: string;
}

/** Point-in-time capacity snapshot for reporting. */
export interface CapacitySnapshot {
	date: string;
	resources: Array<{
		name: string;
		totalCapacityHours: number;
		allocatedHours: number;
		availableHours: number;
	}>;
	totalCapacity: number;
	totalAllocated: number;
	utilizationPct: number;
}
