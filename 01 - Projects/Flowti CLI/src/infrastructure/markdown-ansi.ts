/**
 * markdown-ansi.ts — Render markdown to ANSI-styled terminal output.
 *
 * General-purpose utility for displaying vault markdown content in the CLI.
 * Converts headings, inline code, horizontal rules, and indented blocks
 * to ANSI escape sequences for styled terminal output.
 */

import { RESET, BOLD, DIM, CYAN } from "./ui.js";

/**
 * Render a markdown string to ANSI-styled terminal output.
 *
 * Supported syntax:
 *   # Heading 1    → BOLD
 *   ## Heading 2   → BOLD
 *   ### Heading 3  → CYAN
 *   `code`         → CYAN
 *   ---            → dim horizontal rule
 *   4-space indent → DIM
 */
export function renderMarkdownToAnsi(markdown: string): string {
	return markdown.split("\n").map(renderLine).join("\n");
}

function renderLine(line: string): string {
	const trimmed = line.trimEnd();
	if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
		return `  ${DIM}────────────────────────────────────────────${RESET}`;
	}
	const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
	if (headingMatch) {
		const level = headingMatch[1].length;
		const text = headingMatch[2];
		const style = level <= 2 ? BOLD : CYAN;
		return `  ${style}${text}${RESET}`;
	}
	if (line.startsWith("    ")) {
		return `  ${DIM}${line}${RESET}`;
	}
	return `  ${renderInlineCode(trimmed)}`;
}

function renderInlineCode(text: string): string {
	return text.replace(/`([^`]+)`/g, `${CYAN}$1${RESET}`);
}
