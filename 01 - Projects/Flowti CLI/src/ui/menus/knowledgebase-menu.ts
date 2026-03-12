/**
 * knowledgebase-menu.ts — Interactive vault browser for the Flowti CLI.
 *
 * Provides folder traversal, markdown file viewing, and vault search
 * through a terminal-based menu interface. Gated on Obsidian CLI
 * availability and vault initialization.
 *
 * Moved from domain/knowledgebase/knowledgebase.ts to separate display
 * concerns from pure domain logic.
 */

import { input } from "../../infrastructure/input.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { printHeader, BOLD, RESET, DIM, CYAN, YELLOW, GREEN } from "../../infrastructure/ui.js";
import { listFolder, readMarkdownFile, searchVault } from "../../domain/knowledgebase/vault-service.js";
import { showHelp } from "../help.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";


function printEntryList(
	filtered: { name: string; isDir: boolean }[],
	label: string,
	color: string,
	indexMap: Map<number, { name: string; isDir: boolean }>,
	startIndex: number,
	formatName: (name: string) => string,
): number {
	if (filtered.length === 0) return startIndex;

	log(`  ${DIM}${label}${RESET}`);
	let index = startIndex;
	for (const entry of filtered) {
		log(`    ${color}${index})${RESET} ${formatName(entry.name)}`);
		indexMap.set(index++, entry);
	}
	log();
	return index;
}

function navigateBack(currentPath: string): string {
	return currentPath.includes("/")
		? currentPath.substring(0, currentPath.lastIndexOf("/"))
		: "";
}

function renderFolderListing(
	currentPath: string,
): { indexMap: Map<number, { name: string; isDir: boolean }>; isEmpty: boolean } {
	const entries = listFolder(currentPath, { disk, paths });
	const indexMap = new Map<number, { name: string; isDir: boolean }>();
	const dirs = entries.filter((e) => e.isDir);
	const files = entries.filter((e) => !e.isDir && e.name.endsWith(".md"));

	const nextIndex = printEntryList(dirs, "Folders", CYAN, indexMap, 1, (n) => `${n}/`);
	printEntryList(files, "Files", GREEN, indexMap, nextIndex, (n) => n.replace(/\.md$/, ""));

	return { indexMap, isEmpty: dirs.length === 0 && files.length === 0 };
}

function printNavHints(currentPath: string): void {
	const nav: string[] = [];
	nav.push(`${YELLOW}s${RESET})earch`, `${YELLOW}?${RESET})help`);
	if (currentPath) nav.push(`${YELLOW}u${RESET})p`);
	log(`  ${nav.join("  ")}\n`);
	log(`  ${YELLOW}b${RESET}) Back  ${YELLOW}q${RESET}) Quit\n`);
}

function resolveSelectedPath(currentPath: string, name: string): string {
	return currentPath ? `${currentPath}/${name}` : name;
}

function buildKBHeader(currentPath: string): string {
	return currentPath ? `Knowledgebase — ${currentPath}` : "Knowledgebase";
}

type KBChoice = "quit" | "back" | "up" | "search" | "help" | "invalid" | { entry: { name: string; isDir: boolean } };

function classifyKBChoice(choice: string, currentPath: string, indexMap: Map<number, { name: string; isDir: boolean }>): KBChoice {
	if (choice === "q") return "quit";
	if (choice === "b") return "back";
	if (choice === "u" && currentPath) return "up";
	if (choice === "s") return "search";
	if (choice === "?") return "help";
	const selected = indexMap.get(parseInt(choice, 10));
	return selected ? { entry: selected } : "invalid";
}

export async function knowledgebaseMenu(): Promise<MenuResult> {
	let currentPath = "";

	while (true) {
		printHeader(buildKBHeader(currentPath));

		const { indexMap, isEmpty } = renderFolderListing(currentPath);
		if (isEmpty) log(`  ${DIM}(empty folder)${RESET}\n`);

		printNavHints(currentPath);

		const choice = await input.ask("Choice");
		const action = classifyKBChoice(choice, currentPath, indexMap);

		if (action === "quit") return "quit";
		if (action === "back") return "main";
		if (action === "up") { currentPath = navigateBack(currentPath); continue; }
		if (action === "search") { await searchMode(); continue; }
		if (action === "help") { showHelp("knowledgebase"); await input.waitForEnter(); continue; }
		if (action === "invalid") { log("\n  Invalid choice — try again.\n"); continue; }

		const selectedPath = resolveSelectedPath(currentPath, action.entry.name);
		if (action.entry.isDir) { currentPath = selectedPath; } else { await viewFile(selectedPath); }
	}
}

async function viewFile(filePath: string): Promise<void> {
	const content = readMarkdownFile(filePath, { disk, paths });
	if (!content) {
		log(`\n  File not found: ${filePath}\n`);
		return;
	}

	const displayName = filePath.replace(/\.md$/, "").split("/").pop() ?? filePath;
	log();
	log(`  ${BOLD}${"─".repeat(60)}${RESET}`);
	log(`  ${BOLD}  ${displayName}${RESET}`);
	log(`  ${BOLD}${"─".repeat(60)}${RESET}`);
	log();

	// Strip frontmatter for display
	const lines = content.split("\n");
	let start = 0;
	if (lines[0]?.trim() === "---") {
		const fmEnd = lines.indexOf("---", 1);
		if (fmEnd > 0) start = fmEnd + 1;
	}

	const body = lines.slice(start).join("\n").trim();
	for (const line of body.split("\n")) {
		log(`  ${line}`);
	}

	log();
	log(`  ${DIM}${filePath}${RESET}`);
	log();

	await input.ask("Press Enter to continue");
}

async function searchMode(): Promise<void> {
	const query = await input.ask("Search");

	if (!query) return;

	log(`\n  ${DIM}Searching...${RESET}`);
	const results = searchVault(query, { shell });

	if (results.length === 0) {
		log(`\n  No results found for "${query}"\n`);
		await input.ask("Press Enter to continue");
		return;
	}

	log(`\n  ${BOLD}Results for "${query}"${RESET} (${results.length} found)\n`);

	const mdResults = results.filter((r) => r.endsWith(".md")).slice(0, 20);
	const indexMap = new Map<number, string>();

	for (let i = 0; i < mdResults.length; i++) {
		const displayName = mdResults[i].replace(/\.md$/, "");
		log(`    ${GREEN}${i + 1})${RESET} ${displayName}`);
		indexMap.set(i + 1, mdResults[i]);
	}
	if (results.length > 20) {
		log(`\n  ${DIM}...and ${results.length - 20} more${RESET}`);
	}

	log();
	const choice = await input.ask("Open # or Enter to go back");

	const num = parseInt(choice, 10);
	const selected = indexMap.get(num);
	if (selected) {
		await viewFile(selected);
	}
}
