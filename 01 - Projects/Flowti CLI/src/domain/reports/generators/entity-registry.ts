/**
 * entity-registry.ts — Entity definitions for the Flowti CLI ecosystem.
 *
 * Each entry describes what the entity is, why it exists, where it lives
 * in the codebase, and how it relates to other entities.
 */

// ── Entity definitions ──────────────────────────────────────────────

export interface EntityDef {
	name: string;
	description: string;
	purpose: string;
	locations: string[];
	configKey?: string;
	relatedEntities: string[];
	commands: string[];
	artifacts: string[];
}

export const ENTITY_REGISTRY: EntityDef[] = [
	{
		name: "Flowti Project",
		description: "A named project folder managed by the Flowti CLI. Each project has its own config, reports, and tool bindings.",
		purpose: "Unit of organization. All CLI commands operate within a project context. Projects live under the vault's project directory.",
		locations: [
			"src/domain/project/project.ts — project listing, selection, creation",
			"src/domain/project/project-config.ts — config loading, validation, initialization",
			"src/infrastructure/state.ts — persisted project selection",
		],
		configKey: "name (required), tools, make, reports, docs, publish, review",
		relatedEntities: ["Report", "Component", "Event Catalog", "Component Library", "Health Snapshot", "Scaffold Definition"],
		commands: ["project", "scaffold:new", "scaffold:list", "info"],
		artifacts: ["configs/flowti.config.json", "package.json"],
	},
	{
		name: "Journey",
		description: "An end-to-end test scenario defined as a JSON configuration file. Journeys describe multi-step user flows with assertions.",
		purpose: "E2E test authoring and execution. Journeys define the steps, tools, and assertions for testing complete user workflows.",
		locations: [
			"src/domain/e2e/ — E2E service, runner, interactive session",
			"src/domain/make/makers.ts — makeJourney scaffolding",
			"tests/e2e/journeys/ — journey definition files (.journey)",
		],
		configKey: "review.journeysDir",
		relatedEntities: ["Test", "Test Suite", "Report"],
		commands: ["make:journey", "e2e", "e2e:list"],
		artifacts: ["{journeysDir}/{slug}.journey", "tests/e2e/{number}-journey-{slug}.test.ts"],
	},
	{
		name: "Component",
		description: "A building block of the project — UI component, layout, page, or C4 architecture entity — with documentation, a test file, and a JSON definition.",
		purpose: "Structured project decomposition. Components are discovered, scaffolded, browsed, and tested through the CLI.",
		locations: [
			"src/domain/make/component/ — registry, scaffolding, listing",
			"src/domain/make/component/definitions/ — 8 bundled JSON definitions",
			"components/ — per-component folders with docs, definitions, tests, stories",
		],
		configKey: "make.templates",
		relatedEntities: ["Component Library", "Flowti Project"],
		commands: ["make:component", "components"],
		artifacts: ["components/{name}/{name}.md", "components/{name}/{name}.json", "components/{name}/{name}.test.ts"],
	},
	{
		name: "Component Library",
		description: "The collection of all components in a project, discoverable via the component browser menu.",
		purpose: "Catalog and navigation of project components. Provides an overview of all components with their kinds, statuses, and locations.",
		locations: [
			"src/domain/make/component/component-list.ts — discovery, browser menu",
			"src/domain/make/component/component-types.ts — ComponentKind, ComponentDefinition",
		],
		relatedEntities: ["Component", "Flowti Project"],
		commands: ["components"],
		artifacts: ["components/"],
	},
	{
		name: "Test",
		description: "A Vitest test file that verifies behavior. Tests can be unit tests (domain logic), integration tests (flows), or E2E journey tests.",
		purpose: "Quality assurance. Tests are the primary verification mechanism — they gate builds and generate test reports.",
		locations: [
			"tests/ — all test files",
			"src/domain/reports/cli/generate-test-report.ts — test report generator",
		],
		relatedEntities: ["Test Suite", "Report", "Journey"],
		commands: ["build (runs tests as prerequisite)"],
		artifacts: ["reports/tests/testreport.json", "reports/tests/{timestamp}-test-report.md"],
	},
	{
		name: "Test Suite",
		description: "A logical grouping of test files (e.g., all domain tests, all flow tests, all E2E journey tests).",
		purpose: "Organizational unit for test execution. Suites are tracked in test reports with pass/fail/pending counts.",
		locations: [
			"tests/ — directory structure defines suites",
			"configs/vitest.config.ts — test include/exclude patterns",
		],
		relatedEntities: ["Test", "Report"],
		commands: [],
		artifacts: ["reports/tests/testreport.json"],
	},
	{
		name: "Event",
		description: "A named occurrence in the system that can be produced and consumed. Events have domains, versions, and payload schemas.",
		purpose: "Inter-domain communication. Events decouple producers from consumers and enable the event catalog reference document.",
		locations: [
			"src/domain/events/event-catalog.ts — add/list/export operations",
			"src/domain/events/event-store.ts — event persistence",
		],
		configKey: "events (implicit via event files)",
		relatedEntities: ["Event Catalog", "Flowti Project"],
		commands: ["events:add", "events:list", "events:export"],
		artifacts: ["docs/events/{domain}/{event-name}.md"],
	},
	{
		name: "Event Catalog",
		description: "The collection of all event definitions for a project, browsable via the events menu.",
		purpose: "Documentation and discoverability. The event catalog provides a queryable index of all events with their producers, consumers, and schemas.",
		locations: [
			"src/domain/events/event-catalog.ts — interactive menu, CLI commands",
		],
		relatedEntities: ["Event", "Flowti Project"],
		commands: ["events:list", "events:export"],
		artifacts: ["docs/events/"],
	},
	{
		name: "Report",
		description: "A generated markdown document with YAML frontmatter, stored in the reports directory. Reports are timestamped and archived.",
		purpose: "Observability and tracking. Reports capture project health metrics (tests, coverage, complexity, build status) at a point in time.",
		locations: [
			"src/domain/reports/ — generators, registry, runner",
			"src/domain/reports/cli/ — individual report generators",
			"src/domain/reports/report-archive.ts — archive browser",
		],
		configKey: "reports.dir, reports.generators[]",
		relatedEntities: ["Test", "Test Suite", "Flowti Project"],
		commands: ["report:test", "report:coverage", "report:codebase", "report:complexity", "report:status", "report:summary", "reports"],
		artifacts: ["reports/{subdir}/{timestamp}-{slug}.md", "reports/{title}.md"],
	},
	{
		name: "Build Manifest",
		description: "A JSON record of the last successful build — source hash, timestamp, output files, and build duration.",
		purpose: "Build freshness detection. The CLI compares source files against the manifest to determine if a rebuild is needed.",
		locations: [
			"src/domain/build/build-freshness.ts — freshness check, source diff",
		],
		relatedEntities: ["Flowti Project", "Report"],
		commands: ["build:check", "build:auto", "build:record"],
		artifacts: [".flowti/build-manifest.json"],
	},
	{
		name: "Plugin Hooks",
		description: "Lifecycle hooks declared in flowti.config.json, running at specific pipeline points (build/test/publish).",
		purpose: "Extensibility. Inject custom logic into the CLI pipeline without modifying CLI source.",
		locations: [
			"src/domain/plugins/plugin-hooks.ts — hook loading, validation, execution",
			"src/domain/plugins/plugin-loader.ts — hook extraction from config",
		],
		configKey: "hooks.prebuild, hooks.postbuild, hooks.pretest, hooks.posttest",
		relatedEntities: ["Flowti Project"],
		commands: [],
		artifacts: ["flowti.config.json (hooks section)"],
	},
	{
		name: "Scaffold Definition",
		description: "A versioned template definition for scaffolding projects or components, with marketplace distribution.",
		purpose: "Project creation and code generation. Blueprints for new projects with versioning and remote registry support.",
		locations: [
			"src/domain/scaffold/scaffold-schema.ts — schema, validation",
			"src/domain/scaffold/scaffold-version.ts — version comparison",
			"src/domain/scaffold/remote-registry.ts — remote fetch",
			"src/domain/scaffold/marketplace.ts — marketplace listing",
		],
		configKey: "scaffold.definitions",
		relatedEntities: ["Flowti Project", "Export Bundle"],
		commands: ["scaffold:new", "scaffold:list", "marketplace:import"],
		artifacts: [".flowti/definitions/{id}.json"],
	},
	{
		name: "Export Bundle",
		description: "A JSON package of scaffold definitions, AI tools, and plugin metadata for cross-vault sharing.",
		purpose: "Marketplace distribution. Package multiple definitions for import into other Flowti installations.",
		locations: [
			"src/domain/scaffold/marketplace-export.ts — bundle creation, save",
		],
		relatedEntities: ["Scaffold Definition", "Flowti Project"],
		commands: ["marketplace:export"],
		artifacts: ["exports/flowti-bundle-{date}.json"],
	},
	{
		name: "Health Snapshot",
		description: "A point-in-time capture of project health metrics — tests, coverage, lint, complexity, and tech debt.",
		purpose: "Health tracking and trend analysis. Enables historical comparison and quality gate enforcement.",
		locations: [
			"src/domain/health/health.ts — snapshot collection",
			"src/domain/health/health-scoring.ts — quality gate scoring",
			"src/domain/health/health-trends.ts — trend persistence, deltas",
			"src/domain/health/tech-debt.ts — debt estimation",
		],
		relatedEntities: ["Report", "Flowti Project"],
		commands: ["health"],
		artifacts: [".flowti/health-history.json"],
	},
	{
		name: "Resource",
		description: "A project resource (human, material, role, or budget) with pricing, quantity, and consumption tracking for financial analysis.",
		purpose: "Resource management and budgeting. Track people, materials, and roles assigned to a project with cost and consumption data.",
		locations: [
			"src/domain/resources/resource-store.ts — CRUD operations",
			"src/domain/resources/resource-analysis.ts — financial analysis",
			"src/domain/resources/resource-types.ts — type definitions",
			"src/ui/menus/resources-menu.ts — interactive menu",
		],
		configKey: "management.resources",
		relatedEntities: ["Flowti Project", "Time-Log Entry", "Deliverable"],
		commands: ["resources:list", "resources:add", "resources:summary"],
		artifacts: ["docs/resources/{name}.md"],
	},
	{
		name: "Time-Log Entry",
		description: "A time tracking record linking a person, hours, category, and task for project reporting and controlling.",
		purpose: "Time tracking and project controlling. Log hours spent on tasks for reporting, billing, and resource utilization analysis.",
		locations: [
			"src/domain/timelog/timelog-store.ts — CRUD operations",
			"src/domain/timelog/timelog-types.ts — type definitions",
			"src/ui/menus/timelog-menu.ts — interactive menu",
		],
		configKey: "management.timelog",
		relatedEntities: ["Flowti Project", "Resource", "Deliverable"],
		commands: ["timelog:list", "timelog:add", "timelog:summary"],
		artifacts: ["docs/timelog/{date}-{person}.md"],
	},
	{
		name: "Deliverable",
		description: "A tracked project output with status, due date, assignee, priority, and completion percentage.",
		purpose: "Deliverable tracking and status management. Define what the project must deliver, track progress, and manage acceptance criteria.",
		locations: [
			"src/domain/deliverables/deliverable-store.ts — CRUD operations",
			"src/domain/deliverables/deliverable-types.ts — type definitions",
			"src/ui/menus/deliverables-menu.ts — interactive menu",
		],
		configKey: "management.deliverables",
		relatedEntities: ["Flowti Project", "Resource", "Time-Log Entry"],
		commands: ["deliverables:list", "deliverables:add", "deliverables:update"],
		artifacts: ["docs/deliverables/{name}.md"],
	},
	{
		name: "RAID Item",
		description: "A risk, assumption, issue, dependency, or decision tracked in the project RAID log with severity, ownership, and status.",
		purpose: "Risk and issue management. Track project risks, assumptions, issues, dependencies, and decisions with ownership and resolution status.",
		locations: [
			"src/domain/raid/raid-store.ts — CRUD operations",
			"src/domain/raid/raid-types.ts — type definitions",
			"src/ui/menus/raid-menu.ts — interactive menu",
		],
		configKey: "management.raid",
		relatedEntities: ["Flowti Project", "Deliverable", "Resource"],
		commands: ["raid:list", "raid:add", "raid:update"],
		artifacts: ["docs/raid/{name}.md"],
	},
	{
		name: "Requirement",
		description: "An IREB-compliant requirement (functional/non-functional/constraint) with MoSCoW priority and traceability.",
		purpose: "Requirements engineering with IREB compliance, linking to use cases and user stories.",
		locations: [
			"src/domain/requirements/requirement-store.ts — CRUD operations",
			"src/domain/requirements/requirement-types.ts — type definitions",
		],
		configKey: "management.requirements",
		relatedEntities: ["Flowti Project", "Use Case", "User Story", "Deliverable"],
		commands: ["requirements:list", "requirements:add", "requirements:update"],
		artifacts: ["docs/requirements/{name}.md"],
	},
	{
		name: "Use Case",
		description: "An actor-goal scenario with preconditions, postconditions, and main/alternative flows.",
		purpose: "Behavioral specification linked to requirements for traceability.",
		locations: ["src/domain/requirements/requirement-store.ts — CRUD operations"],
		configKey: "management.requirements",
		relatedEntities: ["Requirement", "Flowti Project"],
		commands: ["usecases:list", "usecases:add"],
		artifacts: ["docs/requirements/use-cases/{name}.md"],
	},
	{
		name: "User Story",
		description: "An agile user story with role, goal, benefit, story points, and linked requirements.",
		purpose: "Agile backlog management with acceptance criteria linked to formal requirements.",
		locations: ["src/domain/requirements/requirement-store.ts — CRUD operations"],
		configKey: "management.requirements",
		relatedEntities: ["Requirement", "Flowti Project"],
		commands: ["stories:list", "stories:add"],
		artifacts: ["docs/requirements/user-stories/{name}.md"],
	},
	{
		name: "CAPA Item",
		description: "A corrective or preventive action tracked through identification, root cause analysis, implementation, and verification.",
		purpose: "Quality management following CAPA methodology with severity, source, and verification criteria.",
		locations: [
			"src/domain/capa/capa-store.ts — CRUD operations",
			"src/domain/capa/capa-types.ts — type definitions",
		],
		configKey: "management.capa",
		relatedEntities: ["Flowti Project", "RAID Item", "Deliverable"],
		commands: ["capa:list", "capa:add", "capa:update"],
		artifacts: ["docs/capa/{name}.md"],
	},
	{
		name: "Product",
		description: "A standalone product managed at vault level with its own lifecycle, requirements, deliverables, RAID log, and CAPA.",
		purpose: "Product lifecycle management from concept through launch, growth, maturity, decline, and sunset.",
		locations: [
			"src/domain/lifecycle/discovery.ts — discovery and path resolution",
			"src/domain/lifecycle/lifecycle-store.ts — lifecycle CRUD",
			"src/ui/menus/product-detail-menu.ts — reduced detail menu",
		],
		configKey: "productsFolder",
		relatedEntities: ["Flowti Project", "Lifecycle", "Feature"],
		commands: ["lifecycle:list", "lifecycle:status", "lifecycle:transition", "lifecycle:create"],
		artifacts: ["02 - Products/{name}/lifecycle.md"],
	},
	{
		name: "Feature",
		description: "A standalone or project-nested feature with its own lifecycle and management artifacts.",
		purpose: "Feature lifecycle management from ideation through specification, development, testing, release, and deprecation.",
		locations: [
			"src/domain/lifecycle/discovery.ts — discovery and path resolution",
			"src/domain/lifecycle/lifecycle-store.ts — lifecycle CRUD",
			"src/ui/menus/feature-detail-menu.ts — reduced detail menu",
		],
		configKey: "featuresFolder",
		relatedEntities: ["Flowti Project", "Lifecycle", "Product"],
		commands: ["lifecycle:list", "lifecycle:status", "lifecycle:transition", "lifecycle:create"],
		artifacts: ["03 - Features/{name}/lifecycle.md"],
	},
	{
		name: "Lifecycle",
		description: "A generic state machine managing lifecycles for projects, products, and features with validated transitions and history.",
		purpose: "Core lifecycle engine with entity-specific states, transition validation, and history tracking.",
		locations: [
			"src/domain/lifecycle/lifecycle-engine.ts — pure state machine",
			"src/domain/lifecycle/lifecycle-store.ts — persistence (CRUD, history)",
			"src/domain/lifecycle/lifecycle-types.ts — type definitions",
		],
		configKey: "management.lifecycle",
		relatedEntities: ["Flowti Project", "Product", "Feature"],
		commands: ["lifecycle:status", "lifecycle:transition", "lifecycle:history", "lifecycle:list", "lifecycle:create"],
		artifacts: ["{entity}/lifecycle.md"],
	},
	{
		name: "Entity Template",
		description: "A user-defined markdown template customizing frontmatter and body content for CLI-generated entities.",
		purpose: "Template customization. User-defined defaults that take precedence over CLI defaults.",
		locations: [
			"src/domain/templates/entity-template.ts — loading and merging",
		],
		configKey: "templates",
		relatedEntities: ["Flowti Project", "Component", "Event Catalog", "Resource", "Time-Log Entry", "Deliverable"],
		commands: [],
		artifacts: ["docs/templates/{entityType}.md"],
	},
];
