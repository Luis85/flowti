/**
 * component-list.ts — Browse and list components in a project.
 *
 * Scans docs/components/ for Markdown files with YAML frontmatter
 * to discover existing components and their metadata.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { runMenu } from "../../../infrastructure/menu.js";
import { log } from "../../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, CYAN } from "../../../infrastructure/ui.js";
import type { MenuEntry, MenuResult } from "../../../infrastructure/types.js";
import type { ProjectComponent, ComponentKind } from "./component-types.js";
import { COMPONENT_KINDS } from "./component-types.js";

// ── Frontmatter parsing ─────────────────────────────────────────────

const FM_DELIMITER = /^---\s*$/;

function parseFrontmatter(content: string): Record<string, string> {
	const lines = content.split("\n");
	if (!FM_DELIMITER.test(lines[0])) return {};

	const result: Record<string, string> = {};
	for (let i = 1; i < lines.length; i++) {
		if (FM_DELIMITER.test(lines[i])) break;
		const colon = lines[i].indexOf(":");
		if (colon > 0) {
			const key = lines[i].slice(0, colon).trim();
			const value = lines[i].slice(colon + 1).trim();
			result[key] = value;
		}
	}
	return result;
}

// ── Component discovery ─────────────────────────────────────────────

const COMPONENTS_DIR = "docs/components";

export function listProjectComponents(projectRoot: string): ProjectComponent[] {
	const componentsDir = paths.join(projectRoot, COMPONENTS_DIR);
	if (!disk.existsSync(componentsDir)) return [];

	const files = disk.readdirSync(componentsDir).filter((f) => f.endsWith(".md"));
	const components: ProjectComponent[] = [];

	for (const file of files) {
		try {
			const content = disk.readFileSync(paths.join(componentsDir, file), "utf-8");
			const fm = parseFrontmatter(content);
			const name = file.replace(/\.md$/, "");
			components.push({
				name: fm.name ?? name,
				kind: (COMPONENT_KINDS.includes(fm.type as ComponentKind) ? fm.type : "component") as ComponentKind,
				status: fm.status ?? "unknown",
				path: paths.join(COMPONENTS_DIR, file),
			});
		} catch { /* skip unreadable */ }
	}

	return components.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Component browser menu ──────────────────────────────────────────

const KIND_LABELS: Record<ComponentKind, string> = {
	"component": "Component",
	"system": "System",
	"container": "Container",
	"c4-component": "C4 Component",
	"person": "Person",
};

export async function componentListMenu(projectRoot: string): Promise<MenuResult> {
	const components = listProjectComponents(projectRoot);

	if (components.length === 0) {
		log(`\n  ${DIM}No components found in ${COMPONENTS_DIR}/${RESET}`);
		log(`  ${DIM}Use Make → Add Component to create one.${RESET}\n`);
		return "main";
	}

	log(`\n  ${BOLD}${components.length} component(s)${RESET}\n`);

	const items: MenuEntry[] = components.map((c, i) => {
		const kindLabel = KIND_LABELS[c.kind] ?? c.kind;
		const statusColor = c.status === "active" ? GREEN : DIM;
		return {
			key: String(i + 1),
			label: `${c.name}  ${DIM}${kindLabel}${RESET}  ${statusColor}${c.status}${RESET}`,
			action: () => {
				showComponentDetail(projectRoot, c);
				return "main" as const;
			},
		};
	});

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	return runMenu("Components", items);
}

function showComponentDetail(projectRoot: string, component: ProjectComponent): void {
	log();
	log(`  ${BOLD}${component.name}${RESET}`);
	log(`    Type:     ${KIND_LABELS[component.kind] ?? component.kind}`);
	log(`    Status:   ${component.status}`);
	log(`    Doc:      ${component.path}`);

	// Check for definition JSON
	const defPath = paths.join(projectRoot, "src", "components", component.name, `${component.name}.json`);
	if (disk.existsSync(defPath)) {
		log(`    Def:      src/components/${component.name}/${component.name}.json`);
	}

	// Check for test file
	const testPath = paths.join(projectRoot, "tests", "components", `${component.name}.test.ts`);
	if (disk.existsSync(testPath)) {
		log(`    Test:     tests/components/${component.name}.test.ts`);
	}

	log();
}
