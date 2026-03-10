/**
 * event-contracts.ts — Event contract validation and generation.
 *
 * Parses event catalog markdown files into structured contracts,
 * validates payload schemas for consistency, and generates a
 * contracts.json file for use in test assertions.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import type { IFileSystem } from "../../infrastructure/types.js";

// ── Types ──────────────────────────────────────────────────────────

export interface PayloadField {
	field: string;
	type: string;
	required: boolean;
	description: string;
}

export interface EventContract {
	name: string;
	domain: string;
	version: string;
	description: string;
	producers: string[];
	consumers: string[];
	payload: PayloadField[];
}

export interface ContractIssue {
	event: string;
	field?: string;
	severity: "error" | "warning";
	message: string;
}

export interface ContractValidationResult {
	valid: boolean;
	issues: ContractIssue[];
}

// ── Valid types ─────────────────────────────────────────────────────

const BUILTIN_TYPES = new Set(["string", "number", "boolean", "object", "array", "Date"]);
const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/;

export function isValidType(type: string): boolean {
	return BUILTIN_TYPES.has(type) || PASCAL_CASE_RE.test(type);
}

// ── Parsing ────────────────────────────────────────────────────────

/**
 * Extract payload fields from a markdown table.
 * Expects rows with: | Field | Type | Required | Description |
 */
function parseTableRow(trimmed: string): PayloadField | null {
	const cells = trimmed
		.split("|")
		.slice(1, -1)
		.map((c) => c.trim());

	if (cells.length < 4 || !cells[0]) return null;

	const required = cells[2].toLowerCase();
	return {
		field: cells[0],
		type: cells[1] || "string",
		required: required === "yes" || required === "true" || required === "required",
		description: cells[3] || "",
	};
}

function isHeaderRow(line: string): boolean {
	return /^\|\s*Field\s*\|/i.test(line);
}

function isSeparatorRow(line: string): boolean {
	return /^\|[\s-:|]+\|$/.test(line);
}

export function parsePayloadTable(content: string): PayloadField[] {
	const fields: PayloadField[] = [];
	const lines = content.split(/\r?\n/).map((l) => l.trim());

	let inTable = false;

	for (const line of lines) {
		if (!inTable && isHeaderRow(line)) { inTable = true; continue; }
		if (inTable && isSeparatorRow(line)) continue;
		if (inTable && line.startsWith("|")) {
			const field = parseTableRow(line);
			if (field) fields.push(field);
			continue;
		}
		if (inTable) inTable = false;
	}

	return fields;
}

/**
 * Parse a single event markdown file into an EventContract.
 */
export function parseEventContract(name: string, content: string): EventContract {
	const fm = parseFrontmatterStrings(content);

	const producers = fm.producers
		? fm.producers.split(",").map((s) => s.trim()).filter(Boolean)
		: [];
	const consumers = fm.consumers
		? fm.consumers.split(",").map((s) => s.trim()).filter(Boolean)
		: [];

	return {
		name: fm.name ?? name,
		domain: fm.domain ?? "",
		version: fm.version ?? "1.0.0",
		description: fm.description ?? "",
		producers,
		consumers,
		payload: parsePayloadTable(content),
	};
}

/**
 * Load all event contracts from the events directory.
 */
export function loadEventContracts(eventsDir: string, fs: IFileSystem = disk): EventContract[] {
	if (!fs.existsSync(eventsDir)) return [];

	const files = fs.readdirSync(eventsDir).filter((f: string) => f.endsWith(".md"));
	const contracts: EventContract[] = [];

	for (const file of files) {
		const content = fs.readFileSync(paths.join(eventsDir, file), "utf-8");
		const baseName = file.replace(/\.md$/, "");
		contracts.push(parseEventContract(baseName, content));
	}

	return contracts.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Validation ─────────────────────────────────────────────────────

/**
 * Validate all contracts for schema consistency.
 */
function validateContractMeta(contract: EventContract, issues: ContractIssue[]): void {
	if (!contract.name) {
		issues.push({ event: contract.name || "(unnamed)", severity: "error", message: "Event is missing a name." });
	}
	if (!contract.domain) {
		issues.push({ event: contract.name, severity: "error", message: "Event is missing a domain." });
	}
	if (contract.payload.length === 0) {
		issues.push({ event: contract.name, severity: "warning", message: "No payload fields defined." });
	}
	if (contract.producers.length === 0) {
		issues.push({ event: contract.name, severity: "warning", message: "No producers defined." });
	}
	if (contract.consumers.length === 0) {
		issues.push({ event: contract.name, severity: "warning", message: "No consumers defined." });
	}
}

function validatePayloadFields(contract: EventContract, issues: ContractIssue[]): void {
	const fieldNames = new Set<string>();
	for (const field of contract.payload) {
		if (!field.field) {
			issues.push({ event: contract.name, severity: "error", message: "Payload field has an empty name." });
			continue;
		}
		if (fieldNames.has(field.field)) {
			issues.push({ event: contract.name, field: field.field, severity: "error", message: `Duplicate payload field "${field.field}".` });
		}
		fieldNames.add(field.field);

		if (!field.type) {
			issues.push({ event: contract.name, field: field.field, severity: "error", message: `Field "${field.field}" has an empty type.` });
		} else if (!isValidType(field.type)) {
			issues.push({ event: contract.name, field: field.field, severity: "error", message: `Field "${field.field}" has invalid type "${field.type}". Expected: string, number, boolean, object, array, Date, or PascalCase custom type.` });
		}
	}
}

export function validateContracts(contracts: EventContract[]): ContractValidationResult {
	const issues: ContractIssue[] = [];

	for (const contract of contracts) {
		validateContractMeta(contract, issues);
		validatePayloadFields(contract, issues);
	}

	return {
		valid: issues.filter((i) => i.severity === "error").length === 0,
		issues,
	};
}

// ── Output ─────────────────────────────────────────────────────────

/**
 * Serialize contracts to a JSON string.
 */
export function generateContractsJson(contracts: EventContract[]): string {
	return JSON.stringify(contracts, null, 2);
}

// ── Runtime payload validation ──────────────────────────────────────

export interface PayloadValidationResult {
	valid: boolean;
	errors: string[];
}

const TYPE_CHECKS: Record<string, (v: unknown) => boolean> = {
	string: (v) => typeof v === "string",
	number: (v) => typeof v === "number",
	boolean: (v) => typeof v === "boolean",
	object: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
	array: (v) => Array.isArray(v),
	Date: (v) => typeof v === "string" || v instanceof Date,
};

/**
 * Validate a runtime payload object against an event contract.
 * Returns errors for missing required fields and type mismatches.
 * PascalCase custom types accept any non-null value.
 */
export function validatePayload(contract: EventContract, payload: Record<string, unknown>): PayloadValidationResult {
	const errors: string[] = [];

	for (const field of contract.payload) {
		const value = payload[field.field];

		if (value === undefined || value === null) {
			if (field.required) {
				errors.push(`Missing required field "${field.field}".`);
			}
			continue;
		}

		const checker = TYPE_CHECKS[field.type];
		if (checker) {
			if (!checker(value)) {
				errors.push(`Field "${field.field}" expected type "${field.type}" but got ${typeof value}.`);
			}
		}
		// PascalCase custom types: accept any non-null value (no runtime check possible)
	}

	// Check for unknown fields
	const knownFields = new Set(contract.payload.map((f) => f.field));
	for (const key of Object.keys(payload)) {
		if (!knownFields.has(key)) {
			errors.push(`Unknown field "${key}" not in contract.`);
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Find a contract by event name from a list of contracts.
 */
export function findContract(contracts: EventContract[], eventName: string): EventContract | undefined {
	return contracts.find((c) => c.name === eventName);
}
