/**
 * Pure function for extracting payload fields from an event based on mapping rules.
 * No external dependencies — fully unit-testable.
 */

import { basename } from "../../utils/pathUtils";
import type { PayloadMapping } from "./types";

/**
 * Extracts payload fields from an event context based on mapping rules.
 *
 * @param mappings - The payload mapping rules
 * @param context - The event context (typically the ingestion job payload)
 * @returns The extracted payload as a record
 */
export function extractPayload(
	mappings: PayloadMapping[],
	context: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const mapping of mappings) {
		try {
			const value = extractField(mapping, context);
			if (value !== undefined) {
				result[mapping.field] = value;
			}
		} catch {
			// Skip fields that fail to extract
		}
	}

	return result;
}

/**
 * Extracts a single field value from the context based on the mapping source.
 */
function extractField(
	mapping: PayloadMapping,
	context: Record<string, unknown>
): unknown {
	switch (mapping.source) {
		case "path":
			return extractFromPath(mapping.expression, context);
		case "metadata":
			return extractFromMetadata(mapping.expression, context);
		case "derived":
			return extractDerived(mapping.expression, context);
		default:
			return undefined;
	}
}

/**
 * Extracts a value by running a regex against the file path.
 * Named capture groups become the extracted value.
 */
function extractFromPath(
	expression: string,
	context: Record<string, unknown>
): unknown {
	const path = typeof context.path === "string" ? context.path : undefined;
	if (!path) return undefined;

	const regex = new RegExp(expression);
	const match = regex.exec(path);
	if (!match) return undefined;

	// If there are named groups, return the first one's value
	if (match.groups) {
		const firstGroup = Object.values(match.groups)[0];
		if (firstGroup !== undefined) return firstGroup;
	}

	// Otherwise return the first capture group
	return match[1] ?? match[0];
}

/**
 * Extracts a value from the event metadata (payload fields).
 */
function extractFromMetadata(
	expression: string,
	context: Record<string, unknown>
): unknown {
	return context[expression];
}

/**
 * Extracts a derived value based on a built-in derivation name.
 */
function extractDerived(
	expression: string,
	context: Record<string, unknown>
): unknown {
	const path = typeof context.path === "string" ? context.path : undefined;

	switch (expression) {
		case "basename": {
			if (!path) return undefined;
			const filename = basename(path);
			const dotIndex = filename.lastIndexOf(".");
			return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
		}
		case "extension": {
			if (!path) return undefined;
			const ext = path.split(".").pop() ?? "";
			return ext;
		}
		case "dirname": {
			if (!path) return undefined;
			const lastSlash = path.lastIndexOf("/");
			return lastSlash >= 0 ? path.slice(0, lastSlash) : "";
		}
		case "now":
			return new Date().toISOString();
		default:
			return undefined;
	}
}
