/**
 * component-submenus.ts — Library and data-provider submenus.
 *
 * Extracted from component-list-menu.ts to keep file sizes within limits.
 */

import { runMenu } from "../../infrastructure/menu.js";
import { RESET, BOLD, DIM, GREEN, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { MenuEntry } from "../../infrastructure/types.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import { discoverLibraries, importAllLibraryDefinitions, importLibraryDefinition } from "../../domain/make/component/component-library.js";
import { listDataProviders, createDataProvider, regenerateDataDictionary, readDataProvider, inferSchema } from "../../domain/make/component/data-provider.js";

// ── Library submenu ─────────────────────────────────────────────────

export async function libraryMenu(projectRoot: string, libraryName: string, deps: MenuDeps): Promise<void> {
	let stay = true;
	while (stay) {
		const libraries = discoverLibraries(projectRoot, deps);
		const lib = libraries.find((l) => l.name === libraryName);
		if (!lib) {
			deps.log(`\n  ${DIM}Library "${libraryName}" not found.${RESET}\n`);
			return;
		}

		deps.log("");
		deps.log(`  ${BOLD}${lib.name}${RESET}  ${DIM}${lib.definitions.length} definition(s)${RESET}`);
		deps.log("");

		const items: MenuEntry[] = lib.definitions.map((jsonFile, i) => {
			const name = jsonFile.replace(/\.json$/, "");
			const hasMd = deps.disk.existsSync(deps.paths.join(lib.path, name, `${name}.md`));
			const status = hasMd ? `${GREEN}imported${RESET}` : `${YELLOW}pending${RESET}`;
			return {
				key: String(i + 1),
				label: `${name}  ${status}`,
				action: async () => {
					const result = importLibraryDefinition(projectRoot, libraryName, jsonFile, deps);
					if (result.errors.length > 0) {
						for (const err of result.errors) deps.log(`  ${YELLOW}${err}${RESET}`);
					} else {
						deps.log(`\n  ${GREEN}Imported ${result.name}: ${result.filesWritten} file(s).${RESET}\n`);
					}
					await deps.input.waitForEnter();
				},
			};
		});

		items.push(
			{ separator: true },
			{
				key: "a",
				label: "Import All",
				action: async () => {
					const result = importAllLibraryDefinitions(projectRoot, libraryName, deps);
					if (result.errors.length > 0) {
						for (const err of result.errors) deps.log(`  ${YELLOW}${err}${RESET}`);
					}
					deps.log(`\n  ${GREEN}Imported ${result.total} file(s) from ${libraryName}.${RESET}\n`);
					await deps.input.waitForEnter();
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

export async function dataProviderMenu(projectRoot: string, deps: MenuDeps): Promise<void> {
	let stay = true;
	while (stay) {
		const providers = listDataProviders(projectRoot, deps);

		if (providers.length > 0) {
			deps.log("");
			deps.log(`  ${BOLD}${providers.length} data provider(s)${RESET}`);
			deps.log("");
		} else {
			deps.log(`\n  ${DIM}No data providers found.${RESET}\n`);
		}

		const items: MenuEntry[] = providers.map((p, i) => {
			const dictTag = p.hasDictionary ? `${GREEN}dict${RESET}` : `${YELLOW}no dict${RESET}`;
			return {
				key: String(i + 1),
				label: `${p.name}  ${DIM}${p.recordCount} records${RESET}  ${dictTag}`,
				action: async () => { await dataProviderDetailMenu(projectRoot, p.name, deps); },
			};
		});

		items.push(
			{ separator: true },
			{
				key: "n",
				label: "Add Data Provider",
				action: async () => {
					const name = await deps.input.ask("Provider name (kebab-case, e.g. user-accounts)");
					if (!name) return;
					const result = createDataProvider(projectRoot, name, deps);
					if (result) {
						deps.log(`\n  ${GREEN}Created ${result.jsonPath}${RESET}`);
						deps.log(`  ${GREEN}Created ${result.mdPath}${RESET}\n`);
						await deps.input.waitForEnter();
					} else {
						deps.log(`\n  ${YELLOW}Provider "${name}" already exists.${RESET}\n`);
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

export async function dataProviderDetailMenu(projectRoot: string, name: string, deps: MenuDeps): Promise<void> {
	const data = readDataProvider(projectRoot, name, deps);
	if (!data) {
		deps.log(`\n  ${DIM}Provider "${name}" not found.${RESET}\n`);
		return;
	}

	const schema = inferSchema(data);
	const recordCount = Array.isArray(data) ? data.length : 1;

	deps.log("");
	deps.log(`  ${BOLD}${name}${RESET}  ${DIM}${recordCount} record(s)${RESET}`);
	deps.log("");

	if (schema.length > 0) {
		deps.log(`  ${CYAN}Schema:${RESET}`);
		for (const s of schema) {
			deps.log(`    ${s.field}  ${DIM}${s.type}${RESET}  ${DIM}${s.example}${RESET}`);
		}
		deps.log("");
	}

	const items: MenuEntry[] = [
		{
			key: "r",
			label: "Regenerate Data Dictionary",
			action: async () => {
				const ok = regenerateDataDictionary(projectRoot, name, deps);
				if (ok) {
					deps.log(`\n  ${GREEN}Data dictionary regenerated.${RESET}\n`);
				} else {
					deps.log(`\n  ${YELLOW}Failed to regenerate dictionary.${RESET}\n`);
				}
				await deps.input.waitForEnter();
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
	];

	await runMenu(`Provider: ${name}`, items);
}
