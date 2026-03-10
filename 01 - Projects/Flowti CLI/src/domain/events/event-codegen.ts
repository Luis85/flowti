/**
 * event-codegen.ts — Generate TypeScript interfaces from event contracts.
 *
 * Pure function: takes EventContract[], produces a TypeScript source string
 * with an interface per event contract.
 */

import type { EventContract, PayloadField } from "./event-contracts.js";

// ── Type mapping ────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
	string: "string",
	number: "number",
	boolean: "boolean",
	object: "Record<string, unknown>",
	array: "unknown[]",
	Date: "string | Date",
};

function mapFieldType(field: PayloadField): string {
	return TYPE_MAP[field.type] ?? field.type;
}

// ── Name helpers ────────────────────────────────────────────────────

/** Convert an event name like "user.created" to a PascalCase interface name like "UserCreatedPayload". */
export function eventNameToInterfaceName(name: string): string {
	return name
		.split(/[.\-_]/)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("") + "Payload";
}

// ── Code generation ─────────────────────────────────────────────────

function generateInterface(contract: EventContract): string {
	const name = eventNameToInterfaceName(contract.name);
	const lines: string[] = [];

	if (contract.description) {
		lines.push(`/** ${contract.description} */`);
	}
	lines.push(`export interface ${name} {`);

	for (const field of contract.payload) {
		const tsType = mapFieldType(field);
		const optional = field.required ? "" : "?";
		if (field.description) {
			lines.push(`\t/** ${field.description} */`);
		}
		lines.push(`\t${field.field}${optional}: ${tsType};`);
	}

	lines.push("}");
	return lines.join("\n");
}

/**
 * Generate TypeScript source code for all event contracts.
 * Returns a complete .ts file string with interfaces and an event map.
 */
export function generateEventTypes(contracts: EventContract[]): string {
	if (contracts.length === 0) return "// No event contracts found.\n";

	const sections: string[] = [];

	sections.push("/**");
	sections.push(" * Auto-generated event payload interfaces.");
	sections.push(` * Generated from ${contracts.length} event contract${contracts.length > 1 ? "s" : ""}.`);
	sections.push(" * DO NOT EDIT — regenerate with: flowti events:codegen");
	sections.push(" */\n");

	// Interfaces
	for (const contract of contracts) {
		sections.push(generateInterface(contract));
		sections.push("");
	}

	// Event map type
	sections.push("/** Map of event names to their payload types. */");
	sections.push("export interface EventPayloadMap {");
	for (const contract of contracts) {
		const iface = eventNameToInterfaceName(contract.name);
		sections.push(`\t"${contract.name}": ${iface};`);
	}
	sections.push("}");
	sections.push("");

	return sections.join("\n");
}
