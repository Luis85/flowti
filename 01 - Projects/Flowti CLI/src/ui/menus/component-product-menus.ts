/**
 * component-product-menus.ts — Product management submenus for components.
 *
 * Edit requirements, features, and relationships on component instances.
 */

import { runMenu } from "../../infrastructure/menu.js";
import { RESET, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { MenuEntry } from "../../infrastructure/types.js";
import type { ProductMenuDeps } from "../../infrastructure/deps.js";
import type { ComponentInstance, InstanceRelationship } from "../../domain/make/component/component-editor.js";
import {
	addRequirement, removeRequirement,
	addFeature, removeFeature,
	addRelationship, removeRelationship,
	writeComponentInstance,
} from "../../domain/make/component/component-editor.js";

const RELATIONSHIP_TYPES: InstanceRelationship["type"][] = [
	"uses", "calls", "depends-on", "sends-data-to", "receives-data-from",
];

// ── Requirements menu ────────────────────────────────────────────────

export async function editRequirementsMenu(
	projectRoot: string, componentName: string, instance: ComponentInstance, domain: string | undefined, deps: ProductMenuDeps,
): Promise<void> {
	const reqs = instance.requirements ?? [];

	const items: MenuEntry[] = reqs.map((req, i) => ({
		key: String(i + 1),
		label: req,
		action: async () => {
			const remove = await deps.input.askYesNo(`Remove requirement "${req}"?`);
			if (remove) {
				removeRequirement(instance, req);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${YELLOW}Removed ${req}.${RESET}`);
				await deps.input.waitForEnter();
			}
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add Requirement",
			action: async () => {
				const id = await deps.input.ask("Requirement ID (e.g. REQ-001)");
				if (!id) return;
				addRequirement(instance, id);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${GREEN}Added ${id}.${RESET}`);
				await deps.input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Requirements", items);
}

// ── Features menu ────────────────────────────────────────────────────

export async function editFeaturesMenu(
	projectRoot: string, componentName: string, instance: ComponentInstance, domain: string | undefined, deps: ProductMenuDeps,
): Promise<void> {
	const features = instance.features ?? [];

	const items: MenuEntry[] = features.map((feat, i) => ({
		key: String(i + 1),
		label: feat,
		action: async () => {
			const remove = await deps.input.askYesNo(`Remove feature "${feat}"?`);
			if (remove) {
				removeFeature(instance, feat);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${YELLOW}Removed ${feat}.${RESET}`);
				await deps.input.waitForEnter();
			}
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add Feature",
			action: async () => {
				const name = await deps.input.ask("Feature tag (e.g. dark-mode)");
				if (!name) return;
				addFeature(instance, name);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${GREEN}Added ${name}.${RESET}`);
				await deps.input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Features", items);
}

// ── Relationships menu ───────────────────────────────────────────────

export async function editRelationshipsMenu(
	projectRoot: string, componentName: string, instance: ComponentInstance, domain: string | undefined, deps: ProductMenuDeps,
): Promise<void> {
	const rels = (instance.relationships ?? []) as InstanceRelationship[];

	const items: MenuEntry[] = rels.map((rel, i) => {
		const tech = rel.technology ? ` ${DIM}[${rel.technology}]${RESET}` : "";
		return {
			key: String(i + 1),
			label: `${rel.target} ${CYAN}${rel.type}${RESET}${tech}`,
			action: async () => {
				const remove = await deps.input.askYesNo(`Remove relationship to "${rel.target}" (${rel.type})?`);
				if (remove) {
					removeRelationship(instance, rel.target, rel.type);
					writeComponentInstance(projectRoot, componentName, instance, deps, domain);
					deps.log(`  ${YELLOW}Removed ${rel.target} (${rel.type}).${RESET}`);
					await deps.input.waitForEnter();
				}
			},
		};
	});

	items.push(
		{ separator: true },
		{
			key: "n",
			label: "Add Relationship",
			action: async () => {
				const target = await deps.input.ask("Target component name");
				if (!target) return;
				deps.log(`\n  ${CYAN}Relationship types:${RESET}`);
				for (let i = 0; i < RELATIONSHIP_TYPES.length; i++) {
					deps.log(`    ${i + 1}. ${RELATIONSHIP_TYPES[i]}`);
				}
				const choice = await deps.input.ask("Type number (1-5)", "1");
				const idx = parseInt(choice, 10) - 1;
				if (idx < 0 || idx >= RELATIONSHIP_TYPES.length) return;
				const type = RELATIONSHIP_TYPES[idx];
				const technology = await deps.input.ask("Technology (optional, e.g. REST, gRPC)", "");
				const rel: InstanceRelationship = { target, type };
				if (technology) rel.technology = technology;
				addRelationship(instance, rel);
				writeComponentInstance(projectRoot, componentName, instance, deps, domain);
				deps.log(`  ${GREEN}Added ${target} (${type}).${RESET}`);
				await deps.input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Edit Relationships", items);
}
