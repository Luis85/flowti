/**
 * project-overview.ts — Generates a Project Overview reference page.
 *
 * High-level landing page consolidating project identity, configured
 * capabilities, component count, and key metrics.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { readProjectConfig, readPackageJson } from "../../project/project-config.js";
import { listProjectComponents } from "../../make/component/component-list.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput, ProjectConfig } from "../../../infrastructure/types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateProjectOverview(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const pkg = readPackageJson(projectPath, deps);

	if (!config) {
		return { success: false, outputPath: "", metrics: {}, error: "No flowti.config.json found" };
	}

	const components = listProjectComponents(projectPath, deps);
	const capabilities = detectCapabilities(config);

	const doc = Document.create("Project Overview")
		.mergeFrontmatter({
			type: "ProjectOverview",
			date: deps.clock.iso(),
			project: config.name ?? pkg?.name ?? "unknown",
			capabilities: capabilities.length,
			components: components.length,
			tags: ["reference", "overview", "project"],
		})
		.addBlank()
		.heading(1, "Project Overview")
		.addBlank();

	appendIdentity(doc, config, pkg);
	appendCapabilities(doc, capabilities);
	appendComponentSummary(doc, components.length);
	appendConfiguredDomains(doc, config);

	const outputPath = svc.saveReference(doc, "Project Overview.md");

	return {
		success: true,
		outputPath,
		metrics: { capabilities: capabilities.length, components: components.length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

interface PackageJson { name?: string; version?: string; scripts?: Record<string, string> }

function appendIdentity(doc: Document, config: ProjectConfig, pkg: PackageJson | null): void {
	doc.heading(2, "Identity").addBlank();
	doc.table(
		["Property", "Value"],
		[
			["Name", config.name ?? pkg?.name ?? "—"],
			["Type", config.type ?? "—"],
			["Version", pkg?.version ?? "—"],
		],
	).addBlank();
}

function appendCapabilities(doc: Document, capabilities: string[]): void {
	if (capabilities.length === 0) return;
	doc.heading(2, "Capabilities").addBlank()
		.text("Features activated via `flowti.config.json`:")
		.addBlank();
	doc.list(capabilities).addBlank();
}

function appendComponentSummary(doc: Document, count: number): void {
	doc.heading(2, "Product Components").addBlank();
	doc.text(count > 0
		? `${count} component(s) defined. See ${Document.wikilink("Product Component Catalog")} for details.`
		: "No components defined yet.",
	).addBlank();
}

const DOMAIN_MAP: Array<{ key: keyof ProjectConfig; label: string }> = [
	{ key: "reports", label: "Reports — automated report generation pipeline" },
	{ key: "docs", label: "Documentation — reference generators and external doc tools" },
	{ key: "health", label: "Health — scoring, thresholds, and quality gates" },
	{ key: "publish", label: "Publish — artifact distribution pipeline" },
	{ key: "review", label: "Review — quality review workflow" },
	{ key: "management", label: "Management — RAID, timelog, resources, deliverables" },
	{ key: "components", label: "Components — product component system with Storybook" },
];

function appendConfiguredDomains(doc: Document, config: ProjectConfig): void {
	const domains = DOMAIN_MAP.filter((d) => config[d.key] != null).map((d) => d.label);
	if (domains.length === 0) return;
	doc.heading(2, "Configured Domains").addBlank();
	doc.list(domains).addBlank();
}

const CAPABILITY_MAP: Array<{ key: keyof ProjectConfig; label: string; detail?: (c: ProjectConfig) => string }> = [
	{ key: "build", label: "Build pipeline" },
	{ key: "test", label: "Test runner" },
	{ key: "devtools", label: "Developer tools (lint, type-check)" },
	{ key: "make", label: "Make templates", detail: (c) => `(${(c.make?.templates ?? []).join(", ")})` },
	{ key: "components", label: "Product Components", detail: (c) => c.components?.storybook ? " + Storybook" : "" },
	{ key: "reports", label: "Reports", detail: (c) => `(${c.reports?.generators?.length ?? 0} generators)` },
	{ key: "docs", label: "Documentation", detail: (c) => `(${c.docs?.references?.length ?? 0} references)` },
	{ key: "publish", label: "Publish pipeline" },
	{ key: "review", label: "Review workflow" },
	{ key: "health", label: "Health scoring" },
	{ key: "management", label: "Project management" },
];

function detectCapabilities(config: ProjectConfig): string[] {
	return CAPABILITY_MAP
		.filter((cap) => config[cap.key] != null)
		.map((cap) => cap.label + (cap.detail ? ` ${cap.detail(config)}` : ""));
}
