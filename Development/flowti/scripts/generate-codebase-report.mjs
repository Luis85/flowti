/**
 * generate-codebase-report.mjs
 *
 * Reads the TypeDoc codebase.json and generates a CodebaseReport vault note
 * with queryable YAML frontmatter summarizing project structure metrics.
 *
 * Usage: node scripts/generate-codebase-report.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CODEBASE_JSON = path.join(ROOT, "docs", "reports", "codebase", "codebase.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "codebase");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

/** TypeDoc reflection kind values */
const KIND = {
	MODULE: 2,
	FUNCTION: 64,
	CLASS: 128,
	INTERFACE: 256,
	CONSTRUCTOR: 512,
	PROPERTY: 1024,
	METHOD: 2048,
	TYPE_ALIAS: 2097152,
	GET_SIGNATURE: 262144,
	REFERENCE: 4194304,
};

function countByKind(node) {
	const counts = {};

	function walk(n) {
		if (n.kind != null) {
			counts[n.kind] = (counts[n.kind] || 0) + 1;
		}
		for (const child of n.children || []) {
			walk(child);
		}
	}

	walk(node);
	return counts;
}

function main() {
	if (!fs.existsSync(CODEBASE_JSON)) {
		console.log("[report] No codebase.json found — run typedoc first.");
		return;
	}

	const data = JSON.parse(fs.readFileSync(CODEBASE_JSON, "utf-8"));
	const now = new Date();
	const date = now.toISOString();
	const counts = countByKind(data);

	const fm = {
		type: "CodebaseReport",
		date,
		schema_version: data.schemaVersion || "unknown",
		modules: counts[KIND.MODULE] || 0,
		classes: counts[KIND.CLASS] || 0,
		interfaces: counts[KIND.INTERFACE] || 0,
		functions: counts[KIND.FUNCTION] || 0,
		type_aliases: counts[KIND.TYPE_ALIAS] || 0,
		methods: counts[KIND.METHOD] || 0,
		properties: counts[KIND.PROPERTY] || 0,
		constructors: counts[KIND.CONSTRUCTOR] || 0,
	};

	const frontmatter = ["---", ...Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`), "---"].join("\n");

	const body = [
		"",
		"# Codebase Report",
		"",
		"> [!info] Summary",
		`> Modules: ${fm.modules} | Classes: ${fm.classes} | Interfaces: ${fm.interfaces}`,
		`> Functions: ${fm.functions} | Type Aliases: ${fm.type_aliases}`,
		`> Methods: ${fm.methods} | Properties: ${fm.properties}`,
		"",
	].join("\n");

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const filename = `${safeTimestamp}-codebase-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + body, "utf-8");

	console.log(`[report] CodebaseReport written: ${outputPath}`);
}

main();
