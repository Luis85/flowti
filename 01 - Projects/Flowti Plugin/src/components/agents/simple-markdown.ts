// src/components/agents/simple-markdown.ts

/**
 * Lightweight markdown-to-HTML converter for use inside Lit shadow DOM
 * where Obsidian's MarkdownRenderer is unavailable.
 *
 * Supports: headers (h1-h4), bold, italic, inline code, fenced code blocks,
 * unordered lists (- or *), and blank-line breaks.
 */

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&amp;quot;");
}

export function simpleMarkdown(text: string): string {
	// Extract fenced code blocks first so their content is not transformed
	const codeBlocks: string[] = [];
	const withPlaceholders = text.replace(
		/```(\w*)\n([\s\S]*?)```/g,
		(_match, lang: string, code: string) => {
			const escaped = escapeHtml(code.replace(/\n$/, ""));
			const langAttr = lang ? ` class="language-${lang}"` : "";
			codeBlocks.push(`<pre><code${langAttr}>${escaped}</code></pre>`);
			return `\x00CODEBLOCK_${codeBlocks.length - 1}\x00`;
		},
	);

	const lines = withPlaceholders.split("\n");
	const output: string[] = [];
	let inList = false;

	for (const line of lines) {
		// Code block placeholder — emit as-is
		const placeholderMatch = line.match(/^\x00CODEBLOCK_(\d+)\x00$/);
		if (placeholderMatch) {
			if (inList) { output.push("</ul>"); inList = false; }
			output.push(codeBlocks[Number(placeholderMatch[1])]);
			continue;
		}

		// Blank line
		if (line.trim() === "") {
			if (inList) { output.push("</ul>"); inList = false; }
			output.push("<br/>");
			continue;
		}

		// List items (- or *)
		const listMatch = line.match(/^[-*]\s+(.*)/);
		if (listMatch) {
			if (!inList) { output.push("<ul>"); inList = true; }
			output.push(`<li>${inlineFormat(escapeHtml(listMatch[1]))}</li>`);
			continue;
		}

		// Close list if next line is not a list item
		if (inList) { output.push("</ul>"); inList = false; }

		// Headers h1-h4
		const headerMatch = line.match(/^(#{1,4})\s+(.*)/);
		if (headerMatch) {
			const level = headerMatch[1].length;
			output.push(`<h${level}>${inlineFormat(escapeHtml(headerMatch[2]))}</h${level}>`);
			continue;
		}

		// Regular line
		output.push(inlineFormat(escapeHtml(line)));
	}

	if (inList) { output.push("</ul>"); }

	return output.join("\n");
}

/** Apply inline formatting: bold, italic, inline code */
function inlineFormat(line: string): string {
	return line
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
