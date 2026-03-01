/**
 * Seed registry — single source of truth for E2E seed file content and paths.
 *
 * Defines the files and folders that the installer creates during a fresh
 * install. Used by:
 *   - The `seed` journey tool (create, verify, delete operations)
 *   - globalSetup.ts repairSeedFiles() for skip-mode repair
 *   - fixtures.ts INSTALLER_SEED_FILES for skip-mode detection
 */

// ─── Seed file content ──────────────────────────────────────────────

const WELCOME_CONTENT = [
	"# Welcome to Flowti!",
	"",
	"Your Integrated Business Development Environment is ready.",
	"",
	"## First Steps",
	"",
	"1. **Explore your dashboard** — Open the Analytics Hub to see your Supplier Overview dashboard with live charts and metrics.",
	"2. **Review sample data** — The supplier overview CSV in `03 - Resources/Sample Data/` contains realistic demo data you can modify.",
	"3. **Import your own data** — Drop CSV files into `00 - Connectivity/imports/` to trigger the ingestion pipeline.",
	"4. **Create subscriptions** — Set up event subscriptions to watch for file changes in specific folders.",
	"5. **Build custom queries** — Use the Analytics Query Builder to slice and dice your data.",
	"",
	"## Key Concepts",
	"",
	"- **Events** drive everything — file changes emit events, subscriptions react.",
	"- **Dashboards** visualize query results as tables, stat cards, and charts.",
	"- **Sessions** are time-boxed documentation periods for focused work.",
	"",
	'> Tip: Use the command palette (`Ctrl+P`) and search for "Flowti" to see all available commands.',
].join("\n");

const SUPPLIER_CSV_CONTENT = [
	"Month,Supplier,SKU,Category,Unit Price,Quantity,Total,Lead Time Days,Quality Score,On Time Delivery",
	"2025-09,Acme Components,AC-1001,Fasteners,2.45,1200,2940.00,12,96.2,98.1",
	"2025-09,Nordic Electronics,NE-2001,Sensors,15.30,420,6426.00,10,98.5,99.2",
	"2025-09,Pacific Materials,PM-3001,Raw Aluminum,3.20,2800,8960.00,7,95.0,99.5",
	"2025-10,Acme Components,AC-1001,Fasteners,2.45,1350,3307.50,11,96.5,98.4",
	"2025-10,Nordic Electronics,NE-2001,Sensors,15.30,450,6885.00,10,98.8,99.0",
	"2025-10,Pacific Materials,PM-3001,Raw Aluminum,3.25,2600,8450.00,8,95.2,99.0",
	"2025-11,Acme Components,AC-1001,Fasteners,2.50,1100,2750.00,13,95.8,97.5",
	"2025-11,Nordic Electronics,NE-2001,Sensors,15.50,400,6200.00,11,98.2,98.8",
	"2025-11,Pacific Materials,PM-3001,Raw Aluminum,3.30,2900,9570.00,7,95.5,99.3",
	"2025-12,Acme Components,AC-1001,Fasteners,2.50,950,2375.00,14,96.0,97.8",
	"2025-12,Nordic Electronics,NE-2001,Sensors,15.50,380,5890.00,12,98.0,98.5",
	"2025-12,Pacific Materials,PM-3001,Raw Aluminum,3.35,2500,8375.00,8,94.8,99.1",
	"2026-01,Acme Components,AC-1001,Fasteners,2.55,1250,3187.50,12,96.8,98.5",
	"2026-01,Nordic Electronics,NE-2001,Sensors,15.80,440,6952.00,10,98.9,99.3",
	"2026-01,Pacific Materials,PM-3001,Raw Aluminum,3.40,2700,9180.00,7,95.8,99.5",
	"2026-02,Acme Components,AC-1001,Fasteners,2.55,1300,3315.00,11,97.0,98.8",
	"2026-02,Nordic Electronics,NE-2001,Sensors,16.00,460,7360.00,9,99.1,99.5",
	"2026-02,Pacific Materials,PM-3001,Raw Aluminum,3.45,2850,9832.50,6,96.0,99.8",
].join("\n");

// ─── Registry types ─────────────────────────────────────────────────

export interface SeedEntry {
	/** Unique identifier used in journey JSON. e.g. "welcome-note" */
	id: string;
	/** Vault-relative file path. */
	path: string;
	/** File content. */
	content: string;
}

// ─── Registry ───────────────────────────────────────────────────────

export const SEED_REGISTRY: SeedEntry[] = [
	{
		id: "welcome-note",
		path: "00 - Connectivity/inbox/Welcome to Flowti.md",
		content: WELCOME_CONTENT,
	},
	{
		id: "supplier-csv",
		path: "03 - Resources/Sample Data/supplier-overview.csv",
		content: SUPPLIER_CSV_CONTENT,
	},
];

/**
 * Critical folders scaffolded by the installer.
 * Subset needed by journey tests — repaired in skip mode.
 */
export const SEED_FOLDERS: string[] = [
	"00 - Connectivity",
	"00 - Connectivity/input",
	"00 - Connectivity/inbox",
	"00 - Connectivity/imports",
	"00 - Connectivity/share",
	"00 - Connectivity/feedback",
	"01 - Projects",
	"02 - Areas",
	"03 - Resources",
	"03 - Resources/Attachments",
	"03 - Resources/Sample Data",
	"03 - Resources/Documentation",
	"03 - Resources/Templates",
	"04 - Archive",
	"var",
	"var/data",
	"var/events",
	"var/reports",
];

// ─── Helpers ────────────────────────────────────────────────────────

export function getSeedById(id: string): SeedEntry | undefined {
	return SEED_REGISTRY.find((entry) => entry.id === id);
}

export function getAllSeeds(): SeedEntry[] {
	return SEED_REGISTRY;
}

/** All seed file paths (convenience for fixtures.ts). */
export function getSeedPaths(): string[] {
	return SEED_REGISTRY.map((entry) => entry.path);
}
