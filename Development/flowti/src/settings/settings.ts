import { z } from "zod";

/**
 * Zod schema for Flowti plugin settings.
 * Used for validation and type inference.
 */
export const FlowtiSettingsSchema = z.object({
	debugMode: z.boolean().default(false),
});

/**
 * TypeScript type inferred from the Zod schema.
 */
export type FlowtiSettings = z.infer<typeof FlowtiSettingsSchema>;

/**
 * Default settings values.
 */
export const DEFAULT_SETTINGS: FlowtiSettings = FlowtiSettingsSchema.parse({});

/**
 * Safely validates settings data without throwing.
 * @param data - Raw settings data to validate
 * @returns Validated settings or null if invalid
 */
export function safeParseSettings(data: unknown): FlowtiSettings | null {
	const result = FlowtiSettingsSchema.safeParse(data);
	return result.success ? result.data : null;
}
