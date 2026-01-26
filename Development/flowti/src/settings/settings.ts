import { z } from "zod";

/**
 * Zod schema for Flowti plugin settings.
 * Used for validation and type inference.
 */
export const FlowtiSettingsSchema = z.object({
	/** Enable debug mode for verbose logging */
	debugMode: z.boolean().default(false),

	/** Folder path for storing solution files (relative to vault root) */
	solutionsFolder: z.string().default("Solutions"),
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
