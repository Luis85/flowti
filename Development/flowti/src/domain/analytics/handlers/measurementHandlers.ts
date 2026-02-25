/**
 * Measurement CRUD handler module for the Analytics domain.
 *
 * Follows the dashboardHandlers pattern: pure functions that
 * receive an AnalyticsHandlerContext for state + persistence.
 */

import type { AnalyticsHandlerContext } from "./types";
import type { Measurement, MeasurementType, NumberDisplayFormat } from "../types";
import { clearMeasurementFromTiles } from "./dashboardHandlers";

// ── Queries ──────────────────────────────────────────────

export function listMeasurements(ctx: AnalyticsHandlerContext): Measurement[] {
	return ctx.getState().measurements ?? [];
}

export function getMeasurement(ctx: AnalyticsHandlerContext, id: string): Measurement | undefined {
	return listMeasurements(ctx).find((m) => m.id === id);
}

// ── Create ───────────────────────────────────────────────

export async function createMeasurement(
	ctx: AnalyticsHandlerContext,
	name: string,
	queryId: string,
	type: MeasurementType,
	measureColumn?: string,
	displayFormat?: NumberDisplayFormat,
	description?: string,
): Promise<Measurement> {
	const state = ctx.getState();
	if (!state.measurements) state.measurements = [];

	const now = Date.now();
	const measurement: Measurement = {
		id: ctx.generateId().replace(/^aq_/, "am_"),
		name,
		description,
		queryId,
		type,
		measureColumn,
		displayFormat,
		createdAt: now,
		updatedAt: now,
	};

	state.measurements.push(measurement);
	await ctx.save();
	await ctx.eventBus?.emit("analytics.measurement.created", { measurement });
	return measurement;
}

// ── Update ───────────────────────────────────────────────

export async function updateMeasurement(
	ctx: AnalyticsHandlerContext,
	id: string,
	changes: Partial<Pick<Measurement, "name" | "description" | "type" | "queryId" | "measureColumn" | "displayFormat">>,
): Promise<Measurement | undefined> {
	const measurement = getMeasurement(ctx, id);
	if (!measurement) return undefined;

	if (changes.name !== undefined) measurement.name = changes.name;
	if (changes.description !== undefined) measurement.description = changes.description;
	if (changes.type !== undefined) measurement.type = changes.type;
	if (changes.queryId !== undefined) measurement.queryId = changes.queryId;
	if (changes.measureColumn !== undefined) measurement.measureColumn = changes.measureColumn;
	if (changes.displayFormat !== undefined) measurement.displayFormat = changes.displayFormat;
	measurement.updatedAt = Date.now();

	await ctx.save();
	await ctx.eventBus?.emit("analytics.measurement.updated", { measurement });
	return measurement;
}

// ── Delete ───────────────────────────────────────────────

export async function deleteMeasurement(
	ctx: AnalyticsHandlerContext,
	id: string,
): Promise<boolean> {
	const state = ctx.getState();
	if (!state.measurements) return false;

	const idx = state.measurements.findIndex((m) => m.id === id);
	if (idx < 0) return false;

	const name = state.measurements[idx].name;
	state.measurements.splice(idx, 1);
	await ctx.save();
	await clearMeasurementFromTiles(ctx, id);
	await ctx.eventBus?.emit("analytics.measurement.deleted", { measurementId: id, measurementName: name });
	return true;
}

// ── Favorite ─────────────────────────────────────────────

export async function toggleFavorite(
	ctx: AnalyticsHandlerContext,
	id: string,
): Promise<Measurement | undefined> {
	const measurement = getMeasurement(ctx, id);
	if (!measurement) return undefined;

	measurement.isFavorite = !measurement.isFavorite;
	measurement.updatedAt = Date.now();
	await ctx.save();
	await ctx.eventBus?.emit("analytics.measurement.favorited", {
		measurementId: id,
		measurementName: measurement.name,
		isFavorite: measurement.isFavorite ?? false,
	});
	return measurement;
}
