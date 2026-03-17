/**
 * Converts a subset of HTML to Markdown.
 *
 * Designed for Azure DevOps work item descriptions which use a
 * limited set of HTML elements. See PBI-SIG-003 for the full
 * supported element list and known limitations.
 *
 * v1 limitations:
 * - Nested lists render as flat single-level
 * - Tables stripped to plain text (no Markdown table)
 * - Inline styles and CSS classes silently removed
 * - <div> containers unwrapped (content preserved)
 */

export function htmlToMarkdown(html: string): string {
	if (!html || typeof html !== "string") return "";

	let md = html;

	// ── Block elements (process before inline rules) ──────

	// <pre> → fenced code block (extract first to protect contents)
	md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code: string) => {
		const inner = code.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "$1");
		return `\n\`\`\`\n${stripTags(inner).trim()}\n\`\`\`\n`;
	});

	// Headings <h1>–<h6>
	for (let i = 1; i <= 6; i++) {
		const re = new RegExp(`<h${i}[^>]*>(.*?)<\\/h${i}>`, "gi");
		md = md.replace(re, `\n${"#".repeat(i)} $1\n`);
	}

	// <p> → paragraph with blank line
	md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n\n");

	// <br> variants → newline
	md = md.replace(/<br\s*\/?>/gi, "\n");

	// ── Lists ─────────────────────────────────────────────

	// Ordered lists: convert <li> inside <ol> to numbered items
	md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => {
		let counter = 0;
		return "\n" + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m2, text: string) => {
			counter++;
			return `${counter}. ${stripTags(text).trim()}\n`;
		}) + "\n";
	});

	// Unordered lists: convert <li> inside <ul> to bullet items
	md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) => {
		return "\n" + inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m2, text: string) => {
			return `- ${stripTags(text).trim()}\n`;
		}) + "\n";
	});

	// Stray <li> outside lists (shouldn't happen, but be safe)
	md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");

	// ── Inline elements ───────────────────────────────────

	// <strong> / <b>
	md = md.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**");

	// <em> / <i>
	md = md.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*");

	// <code> (inline)
	md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

	// <a href="url">text</a>
	md = md.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

	// <img src="url" alt="text">
	md = md.replace(/<img\s+[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
	md = md.replace(/<img\s+[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, "![$1]($2)");
	// img with no alt
	md = md.replace(/<img\s+[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

	// ── Containers ────────────────────────────────────────

	// <div> → unwrap
	md = md.replace(/<\/?div[^>]*>/gi, "\n");

	// <table> → strip to plain text (keep cell content)
	md = md.replace(/<\/?(table|thead|tbody|tfoot|tr)[^>]*>/gi, "\n");
	md = md.replace(/<\/?(th|td)[^>]*>/gi, " ");

	// ── Cleanup ───────────────────────────────────────────

	// Strip all remaining HTML tags
	md = stripTags(md);

	// Decode common HTML entities
	md = decodeEntities(md);

	// Collapse 3+ consecutive blank lines → 2
	md = md.replace(/\n{3,}/g, "\n\n");

	return md.trim();
}

function stripTags(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

function decodeEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ");
}
