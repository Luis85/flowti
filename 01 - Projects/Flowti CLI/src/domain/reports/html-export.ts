/**
 * html-export.ts — Convert markdown reports to standalone HTML.
 *
 * Produces self-contained HTML pages with inline CSS.
 * No external dependencies — uses regex-based lightweight markdown conversion.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { splitFrontmatter } from "../../infrastructure/frontmatter.js";

// ── Types ────────────────────────────────────────────────────────────

export interface HtmlExportResult {
	html: string;
	title: string;
	outputPath: string;
}

// ── Markdown → HTML ─────────────────────────────────────────────────

/** Mutable parse state threaded through line handlers. */
interface ParseState {
	html: string[];
	inTable: boolean;
	inList: boolean;
	listType: "ul" | "ol";
}

function closeList(s: ParseState): void {
	if (s.inList) { s.html.push(s.listType === "ul" ? "</ul>" : "</ol>"); s.inList = false; }
}

function closeTable(s: ParseState): void {
	if (s.inTable) { s.html.push("</table>"); s.inTable = false; }
}

function closeBlock(s: ParseState): void {
	closeList(s);
	closeTable(s);
}

function handleHr(line: string, s: ParseState): boolean {
	if (!/^---+$/.test(line.trim())) return false;
	closeBlock(s);
	s.html.push("<hr>");
	return true;
}

function handleHeading(line: string, s: ParseState): boolean {
	const match = line.match(/^(#{1,6})\s+(.*)/);
	if (!match) return false;
	closeBlock(s);
	s.html.push(`<h${match[1].length}>${inlineMarkdown(match[2])}</h${match[1].length}>`);
	return true;
}

function handleTableRow(line: string, s: ParseState): boolean {
	if (!line.includes("|") || !line.trim().startsWith("|")) return false;
	const cells = line.split("|").slice(1, -1).map((c) => c.trim());
	if (cells.every((c) => /^[-:]+$/.test(c))) return true; // skip separator

	if (!s.inTable) {
		closeList(s);
		s.html.push("<table>");
		s.inTable = true;
		s.html.push("<tr>" + cells.map((c) => `<th>${inlineMarkdown(c)}</th>`).join("") + "</tr>");
		return true;
	}
	s.html.push("<tr>" + cells.map((c) => `<td>${inlineMarkdown(c)}</td>`).join("") + "</tr>");
	return true;
}

function handleUnorderedList(line: string, s: ParseState): boolean {
	if (!/^\s*[-*]\s/.test(line)) return false;
	if (!s.inList || s.listType !== "ul") {
		if (s.inList) s.html.push("</ol>");
		s.html.push("<ul>");
		s.inList = true;
		s.listType = "ul";
	}
	s.html.push(`<li>${inlineMarkdown(line.replace(/^\s*[-*]\s/, ""))}</li>`);
	return true;
}

function handleOrderedList(line: string, s: ParseState): boolean {
	if (!/^\s*\d+\.\s/.test(line)) return false;
	if (!s.inList || s.listType !== "ol") {
		if (s.inList) s.html.push("</ul>");
		s.html.push("<ol>");
		s.inList = true;
		s.listType = "ol";
	}
	s.html.push(`<li>${inlineMarkdown(line.replace(/^\s*\d+\.\s/, ""))}</li>`);
	return true;
}

function handleCallout(line: string, lines: string[], i: number, s: ParseState): number {
	if (!line.startsWith("> ")) return -1;
	const calloutMatch = line.match(/^>\s*\[!(\w+)\]\s*(.*)/);
	if (calloutMatch) {
		const type = calloutMatch[1].toLowerCase();
		const title = calloutMatch[2] || type;
		s.html.push(`<div class="callout callout-${type}"><strong>${escapeHtml(title)}</strong>`);
		let j = i + 1;
		while (j < lines.length && lines[j].startsWith("> ")) {
			s.html.push(`<p>${inlineMarkdown(lines[j].slice(2))}</p>`);
			j++;
		}
		s.html.push("</div>");
		return j - 1;
	}
	s.html.push(`<blockquote><p>${inlineMarkdown(line.slice(2))}</p></blockquote>`);
	return i;
}

/**
 * Lightweight markdown-to-HTML converter.
 * Handles: headings, paragraphs, bold, italic, code, links, lists, tables, callouts, hr.
 */
export function markdownToHtml(md: string): string {
	const lines = md.split("\n");
	const s: ParseState = { html: [], inTable: false, inList: false, listType: "ul" };

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (handleHr(line, s)) continue;
		if (handleHeading(line, s)) continue;
		if (handleTableRow(line, s)) { continue; }
		if (s.inTable) closeTable(s);
		if (handleUnorderedList(line, s)) continue;
		if (handleOrderedList(line, s)) continue;
		closeList(s);

		const calloutEnd = handleCallout(line, lines, i, s);
		if (calloutEnd >= 0) { i = calloutEnd; continue; }

		if (line.trim() === "") continue;
		s.html.push(`<p>${inlineMarkdown(line)}</p>`);
	}

	closeList(s);
	closeTable(s);
	return s.html.join("\n");
}

/** Convert inline markdown: bold, italic, code, links. */
function inlineMarkdown(text: string): string {
	let result = escapeHtml(text);
	// Code (backticks)
	result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
	// Bold
	result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	// Italic
	result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
	// Links [text](url)
	result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
	// Wikilinks [[text]]
	result = result.replace(/\[\[([^\]]+)\]\]/g, "<em>$1</em>");
	return result;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// ── HTML template ───────────────────────────────────────────────────

const CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #1a1a1a; background: #fff; }
h1 { border-bottom: 2px solid #e0e0e0; padding-bottom: 0.3em; }
h2 { margin-top: 2em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.2em; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f5f5f5; font-weight: 600; }
tr:nth-child(even) { background: #fafafa; }
code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #666; }
.callout { border-left: 4px solid #4a9eff; background: #f0f7ff; padding: 0.75em 1em; margin: 1em 0; border-radius: 4px; }
.callout-warning { border-color: #f0ad4e; background: #fef9e7; }
.callout-danger, .callout-error { border-color: #d9534f; background: #fdf2f2; }
.callout-success { border-color: #5cb85c; background: #f0fff0; }
.callout-info { border-color: #5bc0de; background: #f0f8ff; }
hr { border: none; border-top: 1px solid #e0e0e0; margin: 2em 0; }
.meta { color: #888; font-size: 0.85em; margin-bottom: 2em; }
a { color: #4a9eff; text-decoration: none; }
a:hover { text-decoration: underline; }
ul, ol { padding-left: 1.5em; }
li { margin: 0.25em 0; }
`.trim();

export function wrapHtml(title: string, body: string, meta?: Record<string, string | number>): string {
	const metaBlock = meta
		? `<div class="meta">${Object.entries(meta).map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}`).join(" &middot; ")}</div>`
		: "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${metaBlock}
${body}
<footer style="margin-top:3em;padding-top:1em;border-top:1px solid #e0e0e0;color:#888;font-size:0.8em;">
Generated by Flowti CLI &middot; ${new Date().toISOString().split("T")[0]}
</footer>
</body>
</html>`;
}

// ── Export function ──────────────────────────────────────────────────

/**
 * Convert a markdown report file to standalone HTML.
 *
 * @param mdPath - Path to the markdown report
 * @param outputDir - Directory to write the HTML file to
 * @returns Export result with the HTML content and output path
 */
export function exportReportToHtml(mdPath: string, outputDir: string): HtmlExportResult | null {
	if (!disk.existsSync(mdPath)) return null;

	const raw = disk.readFileSync(mdPath, "utf-8");
	const split = splitFrontmatter(raw);
	const frontmatter = split?.frontmatter ?? {};
	const body = split?.body ?? raw;

	const title = frontmatter.title ?? paths.basename(mdPath, ".md");
	const meta: Record<string, string | number> = {};
	for (const [k, v] of Object.entries(frontmatter)) {
		meta[k] = v;
	}

	const htmlBody = markdownToHtml(body);
	const html = wrapHtml(title, htmlBody, Object.keys(meta).length > 0 ? meta : undefined);

	const slug = paths.basename(mdPath, ".md");
	const outputPath = paths.join(outputDir, `${slug}.html`);
	disk.mkdirSync(outputDir, { recursive: true });
	disk.writeFileSync(outputPath, html, "utf-8");

	return { html, title, outputPath };
}
