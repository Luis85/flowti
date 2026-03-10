/**
 * generate-entity-reference.ts
 *
 * Generates an Entity Reference document — the entity dictionary of the
 * Flowti CLI ecosystem. Describes each business entity, its purpose,
 * where it lives in the codebase, and how it relates to other entities.
 *
 * Usage: npm run reports (part of reports pipeline)
 */

import { Document } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";
import { clock } from "../../../infrastructure/clock.js";
import { ReportService } from "../cli/report-service.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";

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
			"docs/components/ — per-component markdown documentation",
		],
		configKey: "make.templates",
		relatedEntities: ["Component Library", "Flowti Project"],
		commands: ["make:component", "components"],
		artifacts: ["docs/components/{name}.md", "src/components/{name}/{name}.json", "tests/components/{name}.test.ts"],
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
		artifacts: ["docs/components/"],
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
		description: "Lifecycle hooks declared by a project's flowti.config.json. Hooks run at specific points in the build/test/publish pipeline.",
		purpose: "Extensibility. Hooks allow projects to inject custom logic (linting, formatting, validation) into the CLI pipeline without modifying CLI source.",
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
		description: "A versioned template definition that describes how to scaffold a new project or component. Definitions can be bundled or imported from a remote registry.",
		purpose: "Project creation and code generation. Scaffold definitions are the blueprints for new projects, with versioning and marketplace distribution.",
		locations: [
			"src/domain/scaffold/scaffold-schema.ts — definition schema, validation",
			"src/domain/scaffold/scaffold-version.ts — version comparison, diff",
			"src/domain/scaffold/remote-registry.ts — remote fetch, install",
			"src/domain/scaffold/marketplace.ts — marketplace listing, import",
		],
		configKey: "scaffold.definitions",
		relatedEntities: ["Flowti Project", "Export Bundle"],
		commands: ["scaffold:new", "scaffold:list", "marketplace:import"],
		artifacts: [".flowti/definitions/{id}.json"],
	},
	{
		name: "Export Bundle",
		description: "A JSON package containing scaffold definitions, AI tool definitions, and plugin metadata for sharing across vaults.",
		purpose: "Marketplace distribution. Bundles package multiple definitions for import into other Flowti installations.",
		locations: [
			"src/domain/scaffold/marketplace-export.ts — bundle creation, save",
		],
		relatedEntities: ["Scaffold Definition", "Flowti Project"],
		commands: ["marketplace:export"],
		artifacts: ["exports/flowti-bundle-{date}.json"],
	},
	{
		name: "Health Snapshot",
		description: "A point-in-time capture of project health metrics — test results, coverage, lint warnings, complexity scores, and tech debt items.",
		purpose: "Health tracking and trend analysis. Snapshots are saved to enable historical comparison and quality gate enforcement.",
		locations: [
			"src/domain/health/health.ts — snapshot collection",
			"src/domain/health/health-scoring.ts — quality gate scoring",
			"src/domain/health/health-trends.ts — trend persistence, delta calculation",
			"src/domain/health/tech-debt.ts — debt estimation",
			"src/ui/health-display.ts — console rendering",
		],
		relatedEntities: ["Report", "Flowti Project"],
		commands: ["health"],
		artifacts: [".flowti/health-history.json"],
	},
];

// ── Generator ────────────────────────────────────────────────────────

export function generateEntityReference(projectPath: string): GeneratorOutput {
	const svc = new ReportService(projectPath);
	const entities = ENTITY_REGISTRY;

	const doc = Document.create("Entity Reference")
		.mergeFrontmatter({
			type: "EntityReference",
			date: clock.iso(),
			total_entities: entities.length,
			tags: ["reference", "entities", "architecture"],
		})
		.addBlank()
		.heading(1, "Entity Reference")
		.addBlank()
		.text("The entity dictionary of the Flowti CLI ecosystem. Each entry describes what the entity is, why it exists, where it lives in the codebase, and how it relates to other entities.")
		.addBlank();

	// Summary table
	doc.heading(2, "Summary")
		.addBlank()
		.table(
			["Entity", "Commands", "Related To"],
			entities.map((e) => [
				`[[#${e.name}\\|${e.name}]]`,
				e.commands.length > 0 ? e.commands.map((c) => `\`${c}\``).join(", ") : "—",
				e.relatedEntities.join(", ") || "—",
			]),
		)
		.addBlank();

	// Detail sections
	for (const entity of entities) {
		doc.heading(2, entity.name)
			.addBlank()
			.text(entity.description)
			.addBlank()
			.heading(3, "Purpose")
			.addBlank()
			.text(entity.purpose)
			.addBlank();

		doc.heading(3, "Where")
			.addBlank()
			.list(entity.locations)
			.addBlank();

		if (entity.configKey) {
			doc.heading(3, "Configuration")
				.addBlank()
				.text(`Config keys: \`${entity.configKey}\``)
				.addBlank();
		}

		if (entity.commands.length > 0) {
			doc.heading(3, "Commands")
				.addBlank()
				.list(entity.commands.map((c) => `\`flowti ${c}\``))
				.addBlank();
		}

		if (entity.artifacts.length > 0) {
			doc.heading(3, "Artifacts")
				.addBlank()
				.list(entity.artifacts.map((a) => `\`${a}\``))
				.addBlank();
		}

		if (entity.relatedEntities.length > 0) {
			doc.heading(3, "Related Entities")
				.addBlank()
				.list(entity.relatedEntities.map((r) => `[[#${r}|${r}]]`))
				.addBlank();
		}

		doc.addSeparator().addBlank();
	}

	// Save — reference document (stable only, no timestamps)
	const outputPath = svc.saveReference(doc, "Entity Reference.md");

	log(`  Entity Reference: ${entities.length} entities → ${outputPath}`);

	return {
		success: true,
		outputPath,
		metrics: { total_entities: entities.length },
	};
}
