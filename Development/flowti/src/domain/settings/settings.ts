import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Catalog Category Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Configuration for a single catalog category: name and visibility.
 */
export interface CatalogCategoryConfig {
	name: string;
	visible: boolean;
}

const CatalogCategoryConfigSchema = z.object({
	name: z.string(),
	visible: z.boolean(),
}) satisfies z.ZodType<CatalogCategoryConfig>;

/**
 * Default catalog category order and visibility.
 * End-user focused: domain categories first (visible),
 * infrastructure internals last (hidden).
 */
export const DEFAULT_CATALOG_CATEGORIES: CatalogCategoryConfig[] = [
	// Visible by default — end-user facing
	{ name: "User", visible: true },
	{ name: "Settings", visible: true },
	{ name: "Installer", visible: true },
	{ name: "Discovery", visible: true },
	{ name: "File Notifications", visible: true },
	{ name: "Folder Notifications", visible: true },
	{ name: "Workspace", visible: true },
	{ name: "Metadata", visible: true },
	// Hidden by default — infrastructure internals
	{ name: "Plugin Lifecycle", visible: false },
	{ name: "Service Lifecycle", visible: false },
	{ name: "Commands", visible: false },
	{ name: "Views", visible: false },
	{ name: "Logging", visible: false },
	{ name: "Errors", visible: false },
	{ name: "File Requests", visible: false },
	{ name: "File Responses", visible: false },
	{ name: "Event-File Notifications", visible: false },
	{ name: "Frontmatter Requests", visible: false },
	{ name: "Frontmatter Responses", visible: false },
	{ name: "Event Filter", visible: false },
	{ name: "Event Notify", visible: false },
];

// ─────────────────────────────────────────────────────────────
// Settings Schema
// ─────────────────────────────────────────────────────────────

/**
 * Zod schema for Flowti plugin settings.
 * Used for validation and type inference.
 */
export const FlowtiSettingsSchema = z.object({
	debugMode: z.boolean().default(false),
	eventDocsBasePath: z.string().default("03 - Resources/Documentation/Reference/Events"),
	catalogCategories: z.array(CatalogCategoryConfigSchema).default(DEFAULT_CATALOG_CATEGORIES),
	collapsedCategories: z.array(z.string()).default([]),
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
