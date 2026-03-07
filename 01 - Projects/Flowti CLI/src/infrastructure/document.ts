/**
 * document.ts — Centralized Obsidian-compatible markdown document builder.
 *
 * Provides a fluent API for constructing markdown documents with YAML frontmatter,
 * callouts, tables, code blocks, wikilinks, and all standard Obsidian features.
 *
 * Single source of truth for yamlEscape() — eliminates 14 duplicate copies.
 */

import path from "node:path";
import { disk } from "./filesystem.js";
import type { IFileSystem } from "../types.js";

// ── Types ────────────────────────────────────────────────────────────

export type FrontmatterValue = string | number | boolean | null | undefined | string[] | RawValue;

export interface BodyLine {
	prefix: string;
	content: string;
}

export interface RawValue {
	[RAW]: true;
	value: string;
}

export interface TableOptions {
	alignRight?: number[];
}

// ── YAML helpers ─────────────────────────────────────────────────────

/**
 * Escapes a value for safe inclusion in YAML frontmatter.
 * Handles nulls, booleans, numbers, and strings with special characters.
 */
export function yamlEscape(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

// ── Sentinel for raw YAML values ─────────────────────────────────────

const RAW: unique symbol = Symbol("raw");

function raw(value: string): RawValue {
	return { [RAW]: true, value };
}

function isRaw(value: unknown): value is RawValue {
	return typeof value === "object" && value !== null && RAW in value;
}

// ── Document class ───────────────────────────────────────────────────

export class Document {
	#name: string;
	#frontmatter: Map<string, FrontmatterValue>;
	#body: BodyLine[];

	constructor(name: string, frontmatter: Record<string, FrontmatterValue> = {}, body: BodyLine[] = []) {
		this.#name = name;
		this.#frontmatter = new Map(Object.entries(frontmatter));
		this.#body = [...body];
	}

	// ── Static factories ───────────────────────────────────────────

	static create(name: string, frontmatter: Record<string, FrontmatterValue> = {}, body: BodyLine[] = []): Document {
		return new Document(name, frontmatter, body);
	}

	static from({ name, frontmatter = {}, body = [] }: { name: string; frontmatter?: Record<string, FrontmatterValue>; body?: BodyLine[] }): Document {
		return new Document(name, frontmatter, body);
	}

	static wikilink(target: string, alias?: string): string {
		return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
	}

	// ── Frontmatter ────────────────────────────────────────────────

	setFrontmatter(key: string, value: FrontmatterValue): this {
		this.#frontmatter.set(key, value);
		return this;
	}

	setRawFrontmatter(key: string, value: string): this {
		this.#frontmatter.set(key, raw(value));
		return this;
	}

	mergeFrontmatter(obj: Record<string, FrontmatterValue>): this {
		for (const [key, value] of Object.entries(obj)) {
			this.#frontmatter.set(key, value);
		}
		return this;
	}

	setTags(tags: string[]): this {
		this.#frontmatter.set("tags", tags);
		return this;
	}

	// ── Low-level body ─────────────────────────────────────────────

	addLine(prefix = "", content = ""): this {
		this.#body.push({ prefix, content });
		return this;
	}

	addSeparator(): this {
		this.#body.push({ prefix: "---", content: "" });
		return this;
	}

	addBlank(): this {
		this.#body.push({ prefix: "", content: "" });
		return this;
	}

	// ── High-level body ────────────────────────────────────────────

	heading(level: number, text: string): this {
		this.#body.push({ prefix: "#".repeat(level), content: text });
		return this;
	}

	text(content: string): this {
		this.#body.push({ prefix: "", content });
		return this;
	}

	callout(type: string, title: string, lines: string | string[] = []): this {
		const contentLines = Array.isArray(lines) ? lines : [lines];
		this.#body.push({ prefix: `> [!${type}]`, content: title });
		for (const line of contentLines) {
			this.#body.push({ prefix: ">", content: line });
		}
		return this;
	}

	quote(lines: string | string[]): this {
		const contentLines = Array.isArray(lines) ? lines : [lines];
		for (const line of contentLines) {
			this.#body.push({ prefix: ">", content: line });
		}
		return this;
	}

	table(headers: string[], rows: string[][], options: TableOptions = {}): this {
		const alignRight = new Set(options.alignRight || []);
		const sep = headers.map((_, i) => (alignRight.has(i) ? "---:" : "---"));
		this.#body.push({ prefix: "", content: `| ${headers.join(" | ")} |` });
		this.#body.push({ prefix: "", content: `|${sep.join("|")}|` });
		for (const row of rows) {
			this.#body.push({ prefix: "", content: `| ${row.join(" | ")} |` });
		}
		return this;
	}

	list(items: string[]): this {
		for (const item of items) {
			this.#body.push({ prefix: "-", content: item });
		}
		return this;
	}

	orderedList(items: string[]): this {
		items.forEach((item, i) => {
			this.#body.push({ prefix: `${i + 1}.`, content: item });
		});
		return this;
	}

	codeBlock(language: string, code: string): this {
		this.#body.push({ prefix: "", content: `\`\`\`${language}` });
		for (const line of code.split("\n")) {
			this.#body.push({ prefix: "", content: line });
		}
		this.#body.push({ prefix: "", content: "```" });
		return this;
	}

	mermaid(code: string): this {
		return this.codeBlock("mermaid", code);
	}

	// ── Output ─────────────────────────────────────────────────────

	toString(): string {
		const parts: string[] = [];

		if (this.#frontmatter.size > 0) {
			parts.push(this.#renderFrontmatter());
		}

		if (this.#body.length > 0) {
			parts.push(this.#renderBody());
		}

		return parts.join("\n");
	}

	save(absolutePath: string, fs: IFileSystem = disk): void {
		const dir = path.dirname(absolutePath);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(absolutePath, this.toString(), "utf-8");
	}

	// ── Private rendering ──────────────────────────────────────────

	#renderFrontmatter(): string {
		const lines: string[] = ["---"];
		for (const [key, value] of this.#frontmatter) {
			if (isRaw(value)) {
				lines.push(`${key}: ${value.value}`);
			} else if (Array.isArray(value)) {
				lines.push(`${key}:`);
				for (const item of value) {
					lines.push(`  - ${yamlEscape(item)}`);
				}
			} else {
				lines.push(`${key}: ${yamlEscape(value)}`);
			}
		}
		lines.push("---");
		return lines.join("\n");
	}

	#renderBody(): string {
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
