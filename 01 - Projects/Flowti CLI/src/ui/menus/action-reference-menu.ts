/**
 * action-reference-menu.ts — Action reference browser and picker menus.
 *
 * Extracted from component-detail-menu.ts to keep file sizes manageable.
 */

import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, CYAN } from "../../infrastructure/ui.js";
import type { MenuEntry } from "../../infrastructure/types.js";
import { ACTION_REFERENCE, searchActions } from "../../domain/make/component/action-reference.js";
import type { ActionCategory } from "../../domain/make/component/action-reference.js";
import type { ComponentInstance } from "../../domain/make/component/component-editor.js";
import { addAction, writeComponentInstance } from "../../domain/make/component/component-editor.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";

function editorDeps() { return { disk, paths } as const; }

export async function actionReferenceMenu(): Promise<void> {
	const items: MenuEntry[] = ACTION_REFERENCE.map((cat, i) => ({
		key: String(i + 1),
		label: `${cat.category}  ${DIM}(${cat.actions.length})${RESET}`,
		action: async () => {
			log();
			log(`  ${BOLD}${cat.category} Actions${RESET}`);
			log();
			for (const a of cat.actions) {
				log(`    ${CYAN}${a.name}${RESET}  ${DIM}${a.description}${RESET}`);
			}
			log();
			await input.waitForEnter();
		},
	}));

	items.push(
		{ separator: true },
		{
			key: "s",
			label: "Search",
			action: async () => {
				const term = await input.ask("Search actions");
				if (!term) return;
				const results = searchActions(term);
				if (results.length === 0) {
					log(`\n  ${DIM}No actions matching "${term}".${RESET}\n`);
					return;
				}
				for (const cat of results) {
					log(`\n  ${BOLD}${cat.category}${RESET}`);
					for (const a of cat.actions) {
						log(`    ${CYAN}${a.name}${RESET}  ${DIM}${a.description}${RESET}`);
					}
				}
				log();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Action Reference", items);
}

export async function addFromReferenceMenu(projectRoot: string, componentName: string, instance: ComponentInstance, domain?: string): Promise<void> {
	const existing = new Set(instance.actions ?? []);

	const items: MenuEntry[] = ACTION_REFERENCE.map((cat, i) => ({
		key: String(i + 1),
		label: `${cat.category}  ${DIM}(${cat.actions.length})${RESET}`,
		action: async () => { await addFromCategoryMenu(projectRoot, componentName, instance, cat, existing, domain); },
	}));

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu("Choose Category", items);
}

async function addFromCategoryMenu(
	projectRoot: string, componentName: string, instance: ComponentInstance,
	cat: ActionCategory, existing: Set<string>, domain?: string,
): Promise<void> {
	const items: MenuEntry[] = cat.actions.map((a, i) => {
		const alreadyAdded = existing.has(a.name);
		return {
			key: String(i + 1),
			label: `${a.name}  ${DIM}${a.description}${RESET}${alreadyAdded ? `  ${GREEN}(added)${RESET}` : ""}`,
			action: async () => {
				if (alreadyAdded) {
					log(`\n  ${DIM}${a.name} already exists.${RESET}\n`);
					return;
				}
				addAction(instance, a.name);
				writeComponentInstance(projectRoot, componentName, instance, editorDeps(), domain);
				existing.add(a.name);
				log(`  ${GREEN}Added ${a.name}.${RESET}`);
				await input.waitForEnter();
			},
		};
	});

	items.push(
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	);

	await runMenu(`${cat.category} Actions`, items);
}
