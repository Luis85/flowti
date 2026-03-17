/**
 * Barrel re-export for catalog helper modules.
 *
 * All helpers were split into focused modules under helpers/ for
 * maintainability. This file re-exports everything so existing
 * import paths (`from "./helpers"`) continue to work.
 */

export {
	UNCATEGORIZED_CATEGORY,
	isDiscoveredEvent,
	readFrontmatter,
	fmString,
	fmStringArray,
	normalizeDocFrontmatter,
	normalizeNonConformingFiles,
	resetNormalizationTracker,
	type NonConformingFile,
} from "./helpers/frontmatter";

export {
	isConfigured,
	isSystemOnly,
	getOrderedCategories,
	discoveredToCatalogEntries,
	getVisibleEntries,
	resolveEntry,
	getConfiguredCount,
	getFollowedCount,
} from "./helpers/entryQueries";

export {
	type RelatedCriteria,
	findRelatedFlows,
	findRelatedSystems,
	findRelatedActors,
	findRelatedProducts,
} from "./helpers/crossReferences";

export {
	buildSplitLayout,
	renderStat,
	renderRelatedSection,
	renderSubscriptionForm,
	renderSubscriptionRow,
	type SplitLayout,
	type SubscriptionFormData,
} from "./helpers/rendering";

export {
	getSourcePath,
	openFile,
	openOrCreateEventDoc,
} from "./helpers/fileOps";
