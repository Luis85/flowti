import type { UUID } from "./types";

/**
 * Safely extracts a string field from an unknown object.
 * Returns undefined if the object is not a record or the field is not a string.
 */
export function extractStringField(
	obj: unknown,
	field: string
): string | undefined {
	if (obj == null || typeof obj !== "object") return undefined;
	const value = (obj as Record<string, unknown>)[field];
	return typeof value === "string" ? value : undefined;
}

/**
 * Safely extracts a boolean field from a nested settings object.
 * Expects the object to have a `settings` property containing the flag.
 */
export function extractSettingsBoolean(
	payload: unknown,
	flag: string
): boolean | undefined {
	if (payload == null || typeof payload !== "object") return undefined;
	const settings = (payload as Record<string, unknown>).settings;
	if (settings == null || typeof settings !== "object") return undefined;
	const value = (settings as Record<string, unknown>)[flag];
	return typeof value === "boolean" ? value : undefined;
}

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID if available, otherwise falls back to manual generation.
 * @returns A valid UUID v4 string
 */
export function generateUUID(): UUID {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID() as UUID;
	}
	// Fallback for older environments
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	}) as UUID;
}
