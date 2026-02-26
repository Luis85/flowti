/**
 * Versioned folder configuration for the IBDE installer.
 *
 * Replaces the hardcoded string array in `folders.ts` with a structured,
 * documented configuration. Each folder entry carries a description used
 * by the wizard review page and future config-driven tooling.
 *
 * The embedded `DEFAULT_FOLDER_CONFIG` is the single source of truth.
 * A future enhancement can read overrides from `var/config/installer/v1/folders.json`.
 *
 * PBI-ONB-004, Cycle 46.
 */

// ── Types ────────────────────────────────────────────────────────

export interface FolderConfigEntry {
	/** Vault-relative path (parent-first ordering). */
	path: string;
	/** Human-readable purpose shown in the wizard review page. */
	description: string;
}

export interface FolderConfig {
	version: number;
	description: string;
	folders: FolderConfigEntry[];
}

// ── Embedded default config ──────────────────────────────────────

export const DEFAULT_FOLDER_CONFIG: FolderConfig = {
	version: 1,
	description: "IBDE folder structure — PARA method extended with Connectivity and Data Storage",
	folders: [
		// Connectivity — data exchange with other systems
		{ path: "00 - Connectivity", description: "External connections, imports, and feedback" },
		{ path: "00 - Connectivity/input", description: "Inbound data streams" },
		{ path: "00 - Connectivity/inbox", description: "Incoming items and quick captures" },
		{ path: "00 - Connectivity/imports", description: "CSV and file imports for processing" },
		{ path: "00 - Connectivity/share", description: "Outbound files shared with others" },
		{ path: "00 - Connectivity/feedback", description: "Collected feedback and responses" },

		// Projects — big topics you contribute to
		{ path: "01 - Projects", description: "Active projects and initiatives" },

		// Areas — internalized domains you are responsible for
		{ path: "02 - Areas", description: "Ongoing areas of responsibility" },

		// Resources — tools, documentation, procedures, domain model config
		{ path: "03 - Resources", description: "Reference materials, data, and templates" },
		{ path: "03 - Resources/Attachments", description: "Images, PDFs, and other attachments" },
		{ path: "03 - Resources/Bases", description: "Structured data tables (Dataview bases)" },
		{ path: "03 - Resources/Daily Notes", description: "Daily journal entries" },
		{ path: "03 - Resources/Documentation", description: "Project and domain documentation" },
		{ path: "03 - Resources/Documentation/Reference/Entities", description: "Domain entity definitions" },
		{ path: "03 - Resources/Documentation/Reference/Actors", description: "Actor and stakeholder profiles" },
		{ path: "03 - Resources/Documentation/Reference/Events", description: "Business event definitions" },
		{ path: "03 - Resources/Documentation/How To", description: "Step-by-step how-to guides" },
		{ path: "03 - Resources/Documentation/Tutorials", description: "In-depth tutorials" },
		{ path: "03 - Resources/Documentation/Guides", description: "Conceptual and reference guides" },
		{ path: "03 - Resources/Templates", description: "Reusable note and session templates" },

		// Archives — old and obsolete notes
		{ path: "04 - Archive", description: "Completed or retired items" },

		// External data storage (events, logs, data records)
		{ path: "var", description: "System data storage (events, logs, reports)" },
		{ path: "var/data", description: "Persisted domain data" },
		{ path: "var/events", description: "Event log records" },
		{ path: "var/reports", description: "Generated reports and exports" },
	],
};

// ── Helpers ──────────────────────────────────────────────────────

/** Extract an ordered array of folder paths from the config (backwards-compatible with DEFAULT_IBDE_FOLDERS). */
export function getFolderPaths(config: FolderConfig): readonly string[] {
	return config.folders.map((f) => f.path);
}

/** Return only top-level folder entries (paths without a `/`). */
export function getTopLevelEntries(config: FolderConfig): FolderConfigEntry[] {
	return config.folders.filter((f) => !f.path.includes("/"));
}
