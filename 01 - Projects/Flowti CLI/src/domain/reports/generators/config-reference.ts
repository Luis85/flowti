/**
 * config-reference.ts — Generates a Config Reference document.
 *
 * Documents the project's flowti.config.json — all sections, current values,
 * and their purpose. Config is the contract between the project and the CLI.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput, ProjectConfig } from "../../../infrastructure/types.js";

// ── Section descriptions ─────────────────────────────────────────────

interface SectionMeta {
	key: keyof ProjectConfig;
	label: string;
	description: string;
}

const SECTIONS: SectionMeta[] = [
	{ key: "build", label: "Build", description: "Build tool configuration — command, watch mode, output directory." },
	{ key: "test", label: "Test", description: "Test runner configuration — command, coverage thresholds, report paths." },
	{ key: "devtools", label: "Dev Tools", description: "Developer tooling — linting, formatting, type checking commands." },
	{ key: "make", label: "Make", description: "Template scaffolding — which Make templates are available (journey, component)." },
	{ key: "components", label: "Components", description: "Component system — Storybook framework, directory, visualization settings." },
	{ key: "reports", label: "Reports", description: "Report generation — configured generators, output directories." },
	{ key: "docs", label: "Documentation", description: "Documentation generation — external generators, reference generators, Reference Book settings." },
	{ key: "publish", label: "Publish", description: "Publish pipeline — registry, version strategy, pre-publish checks." },
	{ key: "review", label: "Review", description: "Review pipeline — lint gates, coverage thresholds, quality rules." },
	{ key: "health", label: "Health", description: "Health scoring — custom thresholds, weights, quality gates." },
	{ key: "management", label: "Management", description: "Project management — RAID tracking, timelog, resources, deliverables." },
	{ key: "templates", label: "Templates", description: "Template configuration — custom paths, overrides." },
];

// ── Generator ────────────────────────────────────────────────────────

export function generateConfigReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);

	if (!config) {
		return {
			success: false,
			outputPath: "",
			metrics: {},
			error: "No flowti.config.json found",
		};
	}

	const activeSections = SECTIONS.filter((s) => config[s.key] != null);

	const doc = Document.create("Config Reference")
		.mergeFrontmatter({
			type: "ConfigReference",
			date: deps.clock.iso(),
			total_sections: activeSections.length,
			tags: ["reference", "config", "architecture"],
		})
		.addBlank()
		.heading(1, "Config Reference")
		.addBlank()
		.text("Documents the project's `configs/flowti.config.json` — the contract between the project and the Flowti CLI.")
		.addBlank();

	// Summary table
	doc.heading(2, "Configured Sections").addBlank();
	doc.table(
		["Section", "Status", "Description"],
		SECTIONS.map((s) => [
			`[[#${s.label}\\|${s.label}]]`,
			config[s.key] != null ? "✓ Active" : "— Not configured",
			s.description,
		]),
	).addBlank();

	// Detail sections
	for (const section of SECTIONS) {
		doc.heading(2, section.label).addBlank()
			.text(section.description)
			.addBlank();

		const value = config[section.key];
		if (value == null) {
			doc.text("*Not configured.*").addBlank();
			continue;
		}

		doc.text("```json")
			.text(JSON.stringify(value, null, 2))
			.text("```")
			.addBlank();
	}

	const outputPath = svc.saveReference(doc, "Config Reference.md");

	return {
		success: true,
		outputPath,
		metrics: {
			total_sections: SECTIONS.length,
			active_sections: activeSections.length,
		},
	};
}
