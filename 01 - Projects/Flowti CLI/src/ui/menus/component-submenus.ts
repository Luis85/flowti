/**
 * component-submenus.ts — Library and data-provider submenus.
 *
 * Extracted from component-list-menu.ts to keep file sizes within limits.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import { clock } from "../../infrastructure/clock.js";
import type { MenuEntry } from "../../infrastructure/types.js";
import { discoverLibraries, importAllLibraryDefinitions, importLibraryDefinition } from "../../domain/make/component/component-library.js";
import { listDataProviders, createDataProvider, regenerateDataDictionary, readDataProvider, inferSchema } from "../../domain/make/component/data-provider.js";

function libDeps() { return { disk, paths, clock } as const; }
function providerDeps() { return { disk, paths, clock } as const; }

// ── Library submenu ─────────────────────────────────────────────────

export async function libraryMenu(projectRoot: string, libraryName: string): Promise<void> {
	let stay = true;
	while (stay) {
		const libraries = discoverLibraries(projectRoot, libDeps());
		const lib = libraries.find((l) => l.name === libraryName);
		if (!lib) {
			log(`\n  ${DIM}Library "${libraryName}" not found.${RESET}\n`);
			return;
		}

		log();
		log(`  ${BOLD}${lib.name}${RESET}  ${DIM}${lib.definitions.length} definition(s)${RESET}`);
		log();

		const items: MenuEntry[] = lib.definitions.map((jsonFile, i) => {
			const name = jsonFile.replace(/\.json$/, "");
			const hasMd = disk.existsSync(paths.join(lib.path, name, `${name}.md`));
			const status = hasMd ? `${GREEN}imported${RESET}` : `${YELLOW}pending${RESET}`;
			return {
				key: String(i + 1),
				label: `${name}  ${status}`,
				action: async () => {
					const result = importLibraryDefinition(projectRoot, libraryName, jsonFile, libDeps());
					if (result.errors.length > 0) {
						for (const err of result.errors) log(`  ${YELLOW}${err}${RESET}`);
					} else {
						log(`\n  ${GREEN}Imported ${result.name}: ${result.filesWritten} file(s).${RESET}\n`);
					}
					await input.waitForEnter();
				},
			};
		});

		items.push(
			{ separator: true },
			{
				key: "a",
				label: "Import All",
				action: async () => {
					const result = importAllLibraryDefinitions(projectRoot, libraryName, libDeps());
					if (result.errors.length > 0) {
						for (const err of result.errors) log(`  ${YELLOW}${err}${RESET}`);
					}
					log(`\n  ${GREEN}Imported ${result.total} file(s) from ${libraryName}.${RESET}\n`);
					await input.waitForEnter();
				},
			},
			{ separator: true },
			{ key: "b", label: "Back", action: () => { stay = false; return "main" as const; } },
		);

		const result = await runMenu(`Library: ${lib.name}`, items);
		if (result === "main" || result === "quit") stay = false;
	}
}

// ── Data Provider submenu ───────────────────────────────────────────

export async function dataProviderMenu(projectRoot: string): Promise<void> {
	let stay = true;
	while (stay) {
		const providers = listDataProviders(projectRoot, providerDeps());

		if (providers.length > 0) {
			log();
			log(`  ${BOLD}${providers.length} data provider(s)${RESET}`);
			log();
		} else {
			log(`\n  ${DIM}No data providers found.${RESET}\n`);
		}

		const items: MenuEntry[] = providers.map((p, i) => {
			const dictTag = p.hasDictionary ? `${GREEN}dict${RESET}` : `${YELLOW}no dict${RESET}`;
			return {
				key: String(i + 1),
				label: `${p.name}  ${DIM}${p.recordCount} records${RESET}  ${dictTag}`,
				action: async () => { await dataProviderDetailMenu(projectRoot, p.name); },
			};
		});

		items.push(
			{ separator: true },
			{
				key: "n",
				label: "Add Data Provider",
				action: async () => {
					const name = await input.ask("Provider name (kebab-case, e.g. user-accounts)");
					if (!name) return;
					const result = createDataProvider(projectRoot, name, providerDeps());
					if (result) {
						log(`\n  ${GREEN}Created ${result.jsonPath}${RESET}`);
						log(`  ${GREEN}Created ${result.mdPath}${RESET}\n`);
						await input.waitForEnter();
					} else {
						log(`\n  ${YELLOW}Provider "${name}" already exists.${RESET}\n`);
					}
				},
			},
			{ separator: true },
			{ key: "b", label: "Back", action: () => { stay = false; return "main" as const; } },
		);

		const result = await runMenu("Data Providers", items);
		if (result === "main" || result === "quit") stay = false;
	}
}

export async function dataProviderDetailMenu(projectRoot: string, name: string): Promise<void> {
	const data = readDataProvider(projectRoot, name, providerDeps());
	if (!data) {
		log(`\n  ${DIM}Provider "${name}" not found.${RESET}\n`);
		return;
	}

	const schema = inferSchema(data);
	const recordCount = Array.isArray(data) ? data.length : 1;

	log();
	log(`  ${BOLD}${name}${RESET}  ${DIM}${recordCount} record(s)${RESET}`);
	log();

	if (schema.length > 0) {
		log(`  ${CYAN}Schema:${RESET}`);
		for (const s of schema) {
			log(`    ${s.field}  ${DIM}${s.type}${RESET}  ${DIM}${s.example}${RESET}`);
		}
		log();
	}

	const items: MenuEntry[] = [
		{
			key: "r",
			label: "Regenerate Data Dictionary",
			action: async () => {
				const ok = regenerateDataDictionary(projectRoot, name, providerDeps());
				if (ok) {
					log(`\n  ${GREEN}Data dictionary regenerated.${RESET}\n`);
				} else {
					log(`\n  ${YELLOW}Failed to regenerate dictionary.${RESET}\n`);
				}
				await input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	];

	await runMenu(`Provider: ${name}`, items);
}
