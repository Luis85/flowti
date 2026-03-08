/**
 * menu-builders.ts — Submenu builders for the project detail menu.
 *
 * Extracted from mainMenu.ts for readability and independent testability.
 * Each builder returns a MenuEntry[] for use with runMenu().
 */

import { runAllReports } from "./reports/report-runner.js";
import { runGenerator } from "./reports/generator-registry.js";
import { runReference } from "./reports/reference-registry.js";
import { browseArchive } from "./reports/report-archive.js";
import { shell } from "../infrastructure/shell.js";
import { log } from "../infrastructure/logger.js";
import { RESET, GREEN, RED } from "../infrastructure/ui.js";
import type { MenuEntry } from "../infrastructure/types.js";

// ── Types ──────────────────────────────────────────────────────────

interface ReportGenerator {
	id?: string;
	label: string;
	command?: string;
}

interface DocsGenerator {
	label: string;
	command: string;
}

// ── Reports submenu ────────────────────────────────────────────────

export function buildReportsSubmenu(
	generators: ReportGenerator[],
	projectPath: string,
	reportsDir: string,
): MenuEntry[] {
	const items: MenuEntry[] = [];

	if (generators.length > 0) {
		items.push({
			key: "1",
			label: "Run All Reports",
			action: () => {
				runAllReports(generators, projectPath);
				return "main" as const;
			},
		});
	}

	const offset = generators.length > 0 ? 2 : 1;
	for (let i = 0; i < generators.length; i++) {
		const gen = generators[i];
		items.push({
			key: String(i + offset),
			label: gen.label,
			action: () => {
				if (gen.id) {
					runGenerator(gen.id, projectPath);
				} else if (gen.command) {
					shell.run(gen.command, { cwd: projectPath, label: gen.label });
				}
				return "main" as const;
			},
		});
	}

	items.push(
		{ separator: true },
		{
			key: "a",
			label: "Browse Archive",
			action: () => browseArchive(reportsDir),
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return items;
}

// ── Documentation submenu ──────────────────────────────────────────

const BUILTIN_DOCS = [
	{ label: "CLI Reference", generatorId: "cli-reference" },
	{ label: "Entity Reference", generatorId: "entity-reference" },
];

export function buildDocsSubmenu(
	configGenerators: DocsGenerator[],
	allCommand: string | undefined,
	projectPath: string,
): MenuEntry[] {
	const items: MenuEntry[] = [];
	let keyIdx = 1;

	items.push({
		key: String(keyIdx++),
		label: "Update All",
		action: () => {
			if (allCommand) shell.run(allCommand, { cwd: projectPath, label: "Documentation (all)" });
			for (const gen of configGenerators) {
				shell.run(gen.command, { cwd: projectPath, label: gen.label });
			}
			for (const doc of BUILTIN_DOCS) {
				const result = runReference(doc.generatorId, projectPath);
				if (result && !result.success) {
					log(`  ${RED}${doc.label}: failed${RESET}`);
				} else {
					log(`  ${GREEN}${doc.label}: done${RESET}`);
				}
			}
			return "main" as const;
		},
	});

	items.push({ separator: true });

	for (const gen of configGenerators) {
		items.push({
			key: String(keyIdx++),
			label: gen.label,
			action: () => {
				shell.run(gen.command, { cwd: projectPath, label: gen.label });
				return "main" as const;
			},
		});
	}

	for (const doc of BUILTIN_DOCS) {
		items.push({
			key: String(keyIdx++),
			label: doc.label,
			action: () => {
				runReference(doc.generatorId, projectPath);
				return "main" as const;
			},
		});
	}

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return items;
}

// ── Npm Scripts submenu ────────────────────────────────────────────

export function buildNpmScriptsSubmenu(
	projectPath: string,
	scripts: Record<string, string>,
): MenuEntry[] {
	const names = Object.keys(scripts);
	const items: MenuEntry[] = names.map((name, i) => ({
		key: String(i + 1),
		label: `npm run ${name}`,
		action: () => {
			shell.run(`npm run ${name}`, { cwd: projectPath, label: name });
			return "main" as const;
		},
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return items;
}
