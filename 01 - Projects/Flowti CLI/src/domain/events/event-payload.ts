/**
 * event-payload.ts — Payload field collection and parsing for events.
 *
 * Handles interactive payload field collection and --payload flag parsing
 * for the events:add command.
 */

import { input } from "../../infrastructure/input.js";
import type { EventPayloadField } from "./event-catalog.js";

const VALID_FIELD_TYPES = ["string", "number", "boolean", "object", "array"];

/**
 * Parse a --payload flag value into EventPayloadField[].
 * Format: "fieldName:type:required:description,..."
 */
export function parsePayloadFlag(raw: string): EventPayloadField[] {
	return raw.split(",").map((entry) => {
		const parts = entry.split(":");
		return {
			name: parts[0]?.trim() ?? "",
			type: VALID_FIELD_TYPES.includes(parts[1]?.trim() ?? "") ? parts[1].trim() : "string",
			required: (parts[2]?.trim() ?? "") === "required",
			description: parts[3]?.trim() ?? "",
		};
	}).filter((f) => f.name);
}

/** Interactively collect payload fields from the user. */
export async function collectPayloadFields(): Promise<EventPayloadField[]> {
	const fields: EventPayloadField[] = [];
	const addFields = await input.ask("Add payload fields? (Y/n)", "Y");
	if (addFields.toLowerCase() === "n") return fields;

	let addMore = true;
	while (addMore) {
		const name = await input.ask("Field name");
		if (!name) break;
		const type = await input.ask("Type (string/number/boolean/object/array)", "string");
		const reqRaw = await input.ask("Required? (Y/n)", "Y");
		const desc = await input.ask("Description", "");

		fields.push({
			name,
			type: VALID_FIELD_TYPES.includes(type) ? type : "string",
			required: reqRaw.toLowerCase() !== "n",
			description: desc,
		});

		const another = await input.ask("Add another field? (Y/n)", "Y");
		addMore = another.toLowerCase() !== "n";
	}
	return fields;
}

/** Interactively collect versioning info (previous version + migration notes). */
export async function collectVersioningInfo(): Promise<{ previousVersion?: string; migrationNotes?: string }> {
	const isNew = await input.ask("Is this a new version of an existing event? (y/N)", "N");
	if (isNew.toLowerCase() !== "y") return {};

	const previousVersion = await input.ask("Previous version", "1.0.0");
	const migrationNotes = await input.ask("Migration notes", "");
	return { previousVersion, migrationNotes };
}
