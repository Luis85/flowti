/**
 * knowledgebase.ts — Interactive vault browser for the Flowti CLI.
 *
 * Provides folder traversal, markdown file viewing, and vault search
 * through a terminal-based menu interface. Gated on Obsidian CLI
 * availability and vault initialization.
 */

import { createRL, ask } from "../../infrastructure/readline.js";
import { printHeader, BOLD, RESET, DIM, CYAN, YELLOW, GREEN } from "../../infrastructure/ui.js";
import { isCliAvailable, isVaultInitialized, listFolder, readMarkdownFile, searchVault } from "./vault-service.js";
import type { MenuResult } from "../../types.js";

export function isKnowledgebaseAvailable(): boolean {
	return isCliAvailable() && isVaultInitialized();
}

export async function knowledgebaseMenu(): Promise<MenuResult> {
	let currentPath = "";

	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Knowledgebase" + (currentPath ? ` — ${currentPath}` : ""));

		const entries = listFolder(currentPath);
		const dirs = entries.filter((e) => e.isDir);
		const files = entries.filter((e) => !e.isDir && e.name.endsWith(".md"));

		let index = 1;
		const indexMap = new Map<number, { name: string; isDir: boolean }>();

		if (dirs.length > 0) {
			console.log(`  ${DIM}Folders${RESET}`);
			for (const d of dirs) {
				console.log(`    ${CYAN}${index})${RESET} ${d.name}/`);
				indexMap.set(index++, d);
			}
			console.log();
		}

		if (files.length > 0) {
			console.log(`  ${DIM}Files${RESET}`);
			for (const f of files) {
				const displayName = f.name.replace(/\.md$/, "");
				console.log(`    ${GREEN}${index})${RESET} ${displayName}`);
				indexMap.set(index++, f);
			}
			console.log();
		}

		if (dirs.length === 0 && files.length === 0) {
			console.log(`  ${DIM}(empty folder)${RESET}\n`);
		}

		// Navigation options
		const nav: string[] = [];
		if (currentPath) nav.push(`${YELLOW}b${RESET})ack`);
		nav.push(`${YELLOW}s${RESET})earch`, `${YELLOW}q${RESET})uit`);
		console.log(`  ${nav.join("  ")}\n`);

		const rl = createRL();
		const choice = await ask(rl, "Choice");
		rl.close();

		if (choice === "q") return "main";
		if (choice === "b" && currentPath) {
			currentPath = currentPath.includes("/")
				? currentPath.substring(0, currentPath.lastIndexOf("/"))
				: "";
			continue;
		}
		if (choice === "s") {
			await searchMode();
			continue;
		}

		const num = parseInt(choice, 10);
		const selected = indexMap.get(num);
		if (!selected) {
			console.log("\n  Invalid choice — try again.\n");
			continue;
		}

		const selectedPath = currentPath ? `${currentPath}/${selected.name}` : selected.name;

		if (selected.isDir) {
			currentPath = selectedPath;
		} else {
			await viewFile(selectedPath);
		}
	}
}

async function viewFile(filePath: string): Promise<void> {
	const content = readMarkdownFile(filePath);
	if (!content) {
		console.log(`\n  File not found: ${filePath}\n`);
		return;
	}

	const displayName = filePath.replace(/\.md$/, "").split("/").pop() ?? filePath;
	console.log();
	console.log(`  ${BOLD}${"─".repeat(60)}${RESET}`);
	console.log(`  ${BOLD}  ${displayName}${RESET}`);
	console.log(`  ${BOLD}${"─".repeat(60)}${RESET}`);
	console.log();

	// Strip frontmatter for display
	const lines = content.split("\n");
	let start = 0;
	if (lines[0]?.trim() === "---") {
		const fmEnd = lines.indexOf("---", 1);
		if (fmEnd > 0) start = fmEnd + 1;
	}

	const body = lines.slice(start).join("\n").trim();
	// Indent all lines for cleaner terminal display
	for (const line of body.split("\n")) {
		console.log(`  ${line}`);
	}

	console.log();
	console.log(`  ${DIM}${filePath}${RESET}`);
	console.log();

	const rl = createRL();
	await ask(rl, "Press Enter to continue");
	rl.close();
}

async function searchMode(): Promise<void> {
	const rl = createRL();
	const query = await ask(rl, "Search");
	rl.close();

	if (!query) return;

	console.log(`\n  ${DIM}Searching...${RESET}`);
	const results = searchVault(query);

	if (results.length === 0) {
		console.log(`\n  No results found for "${query}"\n`);
		const rl2 = createRL();
		await ask(rl2, "Press Enter to continue");
		rl2.close();
		return;
	}

	console.log(`\n  ${BOLD}Results for "${query}"${RESET} (${results.length} found)\n`);

	const mdResults = results.filter((r) => r.endsWith(".md")).slice(0, 20);
	const indexMap = new Map<number, string>();

	for (let i = 0; i < mdResults.length; i++) {
		const displayName = mdResults[i].replace(/\.md$/, "");
		console.log(`    ${GREEN}${i + 1})${RESET} ${displayName}`);
		indexMap.set(i + 1, mdResults[i]);
	}
	if (results.length > 20) {
		console.log(`\n  ${DIM}...and ${results.length - 20} more${RESET}`);
	}

	console.log();
	const rl2 = createRL();
	const choice = await ask(rl2, "Open # or Enter to go back");
	rl2.close();

	const num = parseInt(choice, 10);
	const selected = indexMap.get(num);
	if (selected) {
		await viewFile(selected);
	}
}
