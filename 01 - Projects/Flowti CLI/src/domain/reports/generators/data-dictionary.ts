/**
 * generate-data-dictionary.ts
 *
 * Pure helper functions for data dictionary generation.
 */

export interface EntityField {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

export interface EntityType {
	typeName: string;
	group: string;
	tab: string;
	folder: string;
	nameField: string;
	filePattern: string;
	description: string;
	fields: EntityField[];
}

export function findMatchingBrace(source: string, openPos: number): number {
	let depth = 0;
	for (let i = openPos; i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return openPos;
}

/**
 * Extract ENTITY_TYPE_REGISTRY entries from TypeScript source.
 * Each entry is a multi-line object in the array.
 */
export function extractEntityTypes(source: string): EntityType[] {
	const entries: EntityType[] = [];

	// Find the ENTITY_TYPE_REGISTRY array
	const dataStart: number = source.indexOf("ENTITY_TYPE_REGISTRY");
	if (dataStart === -1) return entries;

	const dataSection: string = source.slice(dataStart);

	// Match each top-level object block: { typeName: "...", ... fields: [...] }
	// Use a brace-counting approach since entries contain nested arrays
	let pos: number = 0;
	while (pos < dataSection.length) {
		const openBrace: number = dataSection.indexOf("{", pos);
		if (openBrace === -1) break;

		const end: number = findMatchingBrace(dataSection, openBrace);

		const block: string = dataSection.slice(openBrace, end + 1);

		// Only process blocks that look like entity definitions
		if (block.includes("typeName:")) {
			const entry: EntityType | null = parseEntityBlock(block);
			if (entry) entries.push(entry);
		}

		pos = end + 1;
	}

	return entries;
}

export function parseEntityBlock(block: string): EntityType | null {
	const get = (key: string): string => {
		const m: RegExpMatchArray | null = block.match(new RegExp(`${key}:\\s*"([^"]*?)"`));
		return m ? m[1] : "";
	};

	const typeName: string = get("typeName");
	if (!typeName) return null;

	// Extract fields array
	const fields: EntityField[] = [];
	const fieldsMatch: RegExpMatchArray | null = block.match(/fields:\s*\[([\s\S]*)\]/);
	if (fieldsMatch) {
		const fieldsBlock: string = fieldsMatch[1];
		// Match each field object
		const fieldRegex = /\{\s*name:\s*"([^"]*)"[^}]*type:\s*"([^"]*)"[^}]*required:\s*(true|false)[^}]*description:\s*"([^"]*)"[^}]*\}/g;
		let fm: RegExpExecArray | null;
		while ((fm = fieldRegex.exec(fieldsBlock)) !== null) {
			fields.push({
				name: fm[1],
				type: fm[2],
				required: fm[3] === "true",
				description: fm[4],
			});
		}
	}

	return {
		typeName,
		group: get("group"),
		tab: get("tab"),
		folder: get("folder"),
		nameField: get("nameField"),
		filePattern: get("filePattern"),
		description: get("description"),
		fields,
	};
}

const GROUP_LABELS: Record<string, string> = {
	catalog: "Event Catalog",
	"data-exchange": "Data Exchange",
	special: "Special",
};

export function groupLabel(group: string): string {
	return GROUP_LABELS[group] || group.charAt(0).toUpperCase() + group.slice(1);
}
