/**
 * document.mjs — Centralized Obsidian-compatible markdown document builder.
 *
 * Provides a fluent API for constructing markdown documents with YAML frontmatter,
 * callouts, tables, code blocks, wikilinks, and all standard Obsidian features.
 *
 * Single source of truth for yamlEscape() — eliminates 14 duplicate copies.
 */

import fs from "node:fs";
import path from "node:path";

// ── YAML helpers ─────────────────────────────────────────────────────

/**
 * Escapes a value for safe inclusion in YAML frontmatter.
 * Handles nulls, booleans, numbers, and strings with special characters.
 *
 * @param {*} value - The value to escape
 * @returns {string} YAML-safe string representation
 */
export function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

// ── Sentinel for raw YAML values ─────────────────────────────────────

const RAW = Symbol("raw");

/** @param {string} value - Pre-formatted YAML string (bypasses yamlEscape) */
function raw(value) {
	return { [RAW]: true, value };
}

// ── Document class ───────────────────────────────────────────────────

export class Document {
	/** @type {string} */
	#name;
	/** @type {Map<string, *>} */
	#frontmatter;
	/** @type {Array<{ prefix: string, content: string }>} */
	#body;

	/**
	 * @param {string} name - Document name (used for identification, not file name)
	 * @param {Object} [frontmatter={}] - Initial frontmatter key-value pairs
	 * @param {Array<{ prefix: string, content: string }>} [body=[]] - Initial body lines
	 */
	constructor(name, frontmatter = {}, body = []) {
		this.#name = name;
		this.#frontmatter = new Map(Object.entries(frontmatter));
		this.#body = [...body];
	}

	// ── Static factories ───────────────────────────────────────────

	/**
	 * Creates a new Document.
	 * @param {string} name
	 * @param {Object} [frontmatter={}]
	 * @param {Array<{ prefix: string, content: string }>} [body=[]]
	 * @returns {Document}
	 */
	static create(name, frontmatter = {}, body = []) {
		return new Document(name, frontmatter, body);
	}

	/**
	 * Creates a Document from a descriptor object.
	 * @param {{ name: string, frontmatter?: Object, body?: Array }} descriptor
	 * @returns {Document}
	 */
	static from({ name, frontmatter = {}, body = [] }) {
		return new Document(name, frontmatter, body);
	}

	/**
	 * Renders an Obsidian wikilink.
	 * @param {string} target - Link target
	 * @param {string} [alias] - Optional display alias
	 * @returns {string} Wikilink string
	 */
	static wikilink(target, alias) {
		return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
	}

	// ── Frontmatter ────────────────────────────────────────────────

	/**
	 * Sets a single frontmatter field. Arrays render as block-style YAML.
	 * @param {string} key
	 * @param {*} value - Scalar or array (no objects)
	 * @returns {this}
	 */
	setFrontmatter(key, value) {
		this.#frontmatter.set(key, value);
		return this;
	}

	/**
	 * Sets a raw frontmatter value that bypasses yamlEscape.
	 * Use for pre-formatted YAML strings.
	 * @param {string} key
	 * @param {string} value - Pre-formatted YAML value
	 * @returns {this}
	 */
	setRawFrontmatter(key, value) {
		this.#frontmatter.set(key, raw(value));
		return this;
	}

	/**
	 * Merges multiple frontmatter fields at once.
	 * @param {Object} obj - Key-value pairs to merge
	 * @returns {this}
	 */
	mergeFrontmatter(obj) {
		for (const [key, value] of Object.entries(obj)) {
			this.#frontmatter.set(key, value);
		}
		return this;
	}

	/**
	 * Sets a tags field as a block-style YAML array.
	 * @param {string[]} tags
	 * @returns {this}
	 */
	setTags(tags) {
		this.#frontmatter.set("tags", tags);
		return this;
	}

	// ── Low-level body ─────────────────────────────────────────────

	/**
	 * Adds a line to the body.
	 * @param {string} [prefix=""] - Line prefix (e.g., "##", ">", "-")
	 * @param {string} [content=""] - Line content
	 * @returns {this}
	 */
	addLine(prefix = "", content = "") {
		this.#body.push({ prefix, content });
		return this;
	}

	/**
	 * Adds a horizontal rule separator (---).
	 * @returns {this}
	 */
	addSeparator() {
		this.#body.push({ prefix: "---", content: "" });
		return this;
	}

	/**
	 * Adds a blank line.
	 * @returns {this}
	 */
	addBlank() {
		this.#body.push({ prefix: "", content: "" });
		return this;
	}

	// ── High-level body ────────────────────────────────────────────

	/**
	 * Adds a heading.
	 * @param {number} level - Heading level (1-6)
	 * @param {string} text - Heading text
	 * @returns {this}
	 */
	heading(level, text) {
		this.#body.push({ prefix: "#".repeat(level), content: text });
		return this;
	}

	/**
	 * Adds a plain text line.
	 * @param {string} content
	 * @returns {this}
	 */
	text(content) {
		this.#body.push({ prefix: "", content });
		return this;
	}

	/**
	 * Adds an Obsidian callout block.
	 * @param {string} type - Callout type (info, warning, tip, danger, bug, todo, abstract, quote, success, etc.)
	 * @param {string} title - Callout title
	 * @param {string|string[]} lines - Content lines (string or array of strings)
	 * @returns {this}
	 */
	callout(type, title, lines = []) {
		const contentLines = Array.isArray(lines) ? lines : [lines];
		this.#body.push({ prefix: `> [!${type}]`, content: title });
		for (const line of contentLines) {
			this.#body.push({ prefix: ">", content: line });
		}
		return this;
	}

	/**
	 * Adds a blockquote.
	 * @param {string|string[]} lines - Quote content
	 * @returns {this}
	 */
	quote(lines) {
		const contentLines = Array.isArray(lines) ? lines : [lines];
		for (const line of contentLines) {
			this.#body.push({ prefix: ">", content: line });
		}
		return this;
	}

	/**
	 * Adds a markdown table.
	 * @param {string[]} headers - Column headers
	 * @param {string[][]} rows - Table rows (arrays of cell values)
	 * @param {{ alignRight?: number[] }} [options={}] - Column indices to right-align
	 * @returns {this}
	 */
	table(headers, rows, options = {}) {
		const alignRight = new Set(options.alignRight || []);
		const sep = headers.map((_, i) => (alignRight.has(i) ? "---:" : "---"));
		this.#body.push({ prefix: "", content: `| ${headers.join(" | ")} |` });
		this.#body.push({ prefix: "", content: `|${sep.join("|")}|` });
		for (const row of rows) {
			this.#body.push({ prefix: "", content: `| ${row.join(" | ")} |` });
		}
		return this;
	}

	/**
	 * Adds an unordered list.
	 * @param {string[]} items
	 * @returns {this}
	 */
	list(items) {
		for (const item of items) {
			this.#body.push({ prefix: "-", content: item });
		}
		return this;
	}

	/**
	 * Adds an ordered list.
	 * @param {string[]} items
	 * @returns {this}
	 */
	orderedList(items) {
		items.forEach((item, i) => {
			this.#body.push({ prefix: `${i + 1}.`, content: item });
		});
		return this;
	}

	/**
	 * Adds a fenced code block.
	 * @param {string} language - Language identifier
	 * @param {string} code - Code content
	 * @returns {this}
	 */
	codeBlock(language, code) {
		this.#body.push({ prefix: "", content: `\`\`\`${language}` });
		for (const line of code.split("\n")) {
			this.#body.push({ prefix: "", content: line });
		}
		this.#body.push({ prefix: "", content: "```" });
		return this;
	}

	/**
	 * Adds a Mermaid diagram block.
	 * @param {string} code - Mermaid diagram code
	 * @returns {this}
	 */
	mermaid(code) {
		return this.codeBlock("mermaid", code);
	}

	// ── Output ─────────────────────────────────────────────────────

	/**
	 * Renders the document as a string with YAML frontmatter and markdown body.
	 * @returns {string}
	 */
	toString() {
		const parts = [];

		// Frontmatter
		if (this.#frontmatter.size > 0) {
			parts.push(this.#renderFrontmatter());
		}

		// Body
		if (this.#body.length > 0) {
			parts.push(this.#renderBody());
		}

		return parts.join("\n");
	}

	/**
	 * Saves the document to the given absolute path.
	 * Creates parent directories if needed.
	 * @param {string} absolutePath - Full file path
	 */
	save(absolutePath) {
		const dir = path.dirname(absolutePath);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(absolutePath, this.toString(), "utf-8");
	}

	// ── Private rendering ──────────────────────────────────────────

	#renderFrontmatter() {
		const lines = ["---"];
		for (const [key, value] of this.#frontmatter) {
			// Raw values bypass escaping
			if (value && typeof value === "object" && value[RAW]) {
				lines.push(`${key}: ${value.value}`);
			}
			// Arrays render as block-style YAML
			else if (Array.isArray(value)) {
				lines.push(`${key}:`);
				for (const item of value) {
					lines.push(`  - ${yamlEscape(item)}`);
				}
			}
			// Scalars
			else {
				lines.push(`${key}: ${yamlEscape(value)}`);
			}
		}
		lines.push("---");
		return lines.join("\n");
	}

	#renderBody() {
		return this.#body
			.map(({ prefix, content }) => {
				if (prefix && content) return `${prefix} ${content}`;
				if (prefix) return prefix;
				if (content) return content;
				return "";
			})
			.join("\n");
	}
}
