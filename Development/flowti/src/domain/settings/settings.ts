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
	{ name: "Watch Rules", visible: false },
	{ name: "File Processing", visible: false },
	{ name: "Transforms", visible: false },
	{ name: "Data Exchange", visible: true },
	{ name: "Documentation", visible: false },
	{ name: "UI Commands", visible: false },
	{ name: "Hub", visible: false },
	{ name: "Inbox", visible: true },
	{ name: "Session", visible: true },
	{ name: "Nudge", visible: true },
	{ name: "Signal", visible: true },
	{ name: "Capture", visible: true },
	{ name: "Train", visible: true },
];

// ─────────────────────────────────────────────────────────────
// Entity Path Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Per-entity folder configuration.
 * - subfolder: name appended to docsRootPath (e.g. "Events")
 * - overridePath: absolute vault path that completely overrides base + subfolder
 */
export interface EntityPathConfig {
	subfolder: string;
	overridePath: string;
}

const EntityPathConfigSchema = z.object({
	subfolder: z.string(),
	overridePath: z.string().default(""),
}) satisfies z.ZodType<EntityPathConfig>;

/**
 * Folder paths for each entity type.
 */
export interface EntityPaths {
	events: EntityPathConfig;
	domains: EntityPathConfig;
	services: EntityPathConfig;
	categories: EntityPathConfig;
	flows: EntityPathConfig;
	systems: EntityPathConfig;
	actors: EntityPathConfig;
	products: EntityPathConfig;
}

export const DEFAULT_ENTITY_PATHS: EntityPaths = {
	events: { subfolder: "Events", overridePath: "" },
	domains: { subfolder: "Domains", overridePath: "" },
	services: { subfolder: "Services", overridePath: "" },
	categories: { subfolder: "Categories", overridePath: "" },
	flows: { subfolder: "Flows", overridePath: "" },
	systems: { subfolder: "Systems", overridePath: "" },
	actors: { subfolder: "Actors", overridePath: "" },
	products: { subfolder: "Products", overridePath: "" },
};

const EntityPathsSchema = z.object({
	events: EntityPathConfigSchema.default({ subfolder: "Events", overridePath: "" }),
	domains: EntityPathConfigSchema.default({ subfolder: "Domains", overridePath: "" }),
	services: EntityPathConfigSchema.default({ subfolder: "Services", overridePath: "" }),
	categories: EntityPathConfigSchema.default({ subfolder: "Categories", overridePath: "" }),
	flows: EntityPathConfigSchema.default({ subfolder: "Flows", overridePath: "" }),
	systems: EntityPathConfigSchema.default({ subfolder: "Systems", overridePath: "" }),
	actors: EntityPathConfigSchema.default({ subfolder: "Actors", overridePath: "" }),
	products: EntityPathConfigSchema.default({ subfolder: "Products", overridePath: "" }),
}) satisfies z.ZodType<EntityPaths>;

// ─────────────────────────────────────────────────────────────
// Settings Schema
// ─────────────────────────────────────────────────────────────

/**
 * Zod schema for Flowti plugin settings.
 * Used for validation and type inference.
 */
export const FlowtiSettingsSchema = z.object({
	debugMode: z.boolean().default(false),
	eventSystemEnabled: z.boolean().default(true),
	showSystemEvents: z.boolean().default(false),
	docsRootPath: z.string().default("03 - Resources/Documentation/Reference"),
	captureFolder: z.string().default("00 - Connectivity/inbox"),
	catalogCategories: z.array(CatalogCategoryConfigSchema).default(DEFAULT_CATALOG_CATEGORIES),
	catalogDomains: z.array(CatalogCategoryConfigSchema).default([]),
	catalogServices: z.array(CatalogCategoryConfigSchema).default([]),
	collapsedCategories: z.array(z.string()).default([]),
	ingestionConcurrency: z.number().min(1).max(10).default(3),
	ingestionBatchWindowMs: z.number().min(100).max(5000).default(500),
	ingestionMaxRetries: z.number().min(0).max(10).default(3),
	ingestionWatchEventTypes: z.array(z.string()).default(["file.created", "file.modified"]),
	watchFolders: z.array(z.string()).default([]),
	inboxWatchedFolders: z.array(z.object({
		path: z.string(),
		recursive: z.boolean().default(false),
		isPrimary: z.boolean().default(false),
	})).default([]),
	inboxTriageTargetFolder: z.string().default(""),
	entityPaths: EntityPathsSchema.default(DEFAULT_ENTITY_PATHS),
	sessionActivityFilterGlobal: z.array(z.string()).default([]),
	customSessionTypes: z.record(z.string(), z.object({
		type: z.string(),
		label: z.string(),
		icon: z.string(),
		guidingQuestions: z.array(z.string()),
		defaultDuration: z.number(),
		defaultGoals: z.array(z.string()),
		color: z.string().optional(),
	})).default({}),
	customOutputTemplates: z.array(z.object({
		type: z.enum(["meeting-invite", "action-items", "review-summary", "custom"]),
		title: z.string(),
		description: z.string(),
		sections: z.array(z.object({
			heading: z.string(),
			placeholder: z.string(),
		})),
	})).default([]),
	defaultTrainDuration: z.number().default(0),
	trainFolder: z.string().default("00 - Connectivity/trains"),
	trainAutoOpenTimeline: z.boolean().default(true),
	trainMaxThoughts: z.number().min(1).max(1000).default(100),
	inboxEnabledSources: z.array(z.string()).default([
		"subscription.matched",
		"dataExchange.import.completed",
		"dataExchange.import.failed",
		"dataExchange.export.completed",
		"dataExchange.pipeline.completed",
		"dataExchange.pipeline.failed",
		"inbox.vaultFolder.noteDetected",
		"capture.note.created",
		"signal.sync.completed",
		"signal.sync.failed",
		"train.thought.added",
		"train.completed",
	]),
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
