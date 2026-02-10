import { FolderMapping, DEFAULT_MAPPING_VALUES } from "../types";

/**
 * Schema for exported mapping data.
 * Exported mappings have sourceFolder cleared and enabled set to false,
 * since source paths are machine-specific.
 */
export interface MappingExportData {
	version: 1;
	exportedAt: string;
	pluginVersion: string;
	mappings: FolderMapping[];
}

export interface DeserializeResult {
	mappings: FolderMapping[];
	errors: string[];
}

export interface PrepareImportResult {
	mappings: FolderMapping[];
	warnings: string[];
}

/**
 * Serializes folder mappings to a portable JSON string.
 * Clears sourceFolder and sets enabled=false so the recipient
 * must configure paths before activating.
 */
export function serializeMappings(
	mappings: FolderMapping[],
	pluginVersion: string
): string {
	const exportData: MappingExportData = {
		version: 1,
		exportedAt: new Date().toISOString(),
		pluginVersion,
		mappings: mappings.map((m) => ({
			...m,
			sourceFolder: "",
			enabled: false,
		})),
	};
	return JSON.stringify(exportData, null, 2);
}

/**
 * Deserializes and validates a JSON string into folder mappings.
 * Fills missing optional fields with defaults.
 */
export function deserializeMappings(json: string): DeserializeResult {
	const errors: string[] = [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { mappings: [], errors: ["Invalid JSON format"] };
	}

	if (!parsed || typeof parsed !== "object") {
		return { mappings: [], errors: ["Expected a JSON object"] };
	}

	const data = parsed as Record<string, unknown>;

	if (data.version !== 1) {
		return {
			mappings: [],
			errors: [`Unsupported version: ${String(data.version ?? "missing")}`],
		};
	}

	if (!Array.isArray(data.mappings)) {
		return { mappings: [], errors: ["Missing or invalid mappings array"] };
	}

	const mappings: FolderMapping[] = [];

	for (let i = 0; i < data.mappings.length; i++) {
		const raw = data.mappings[i];
		if (!raw || typeof raw !== "object") {
			errors.push(`Mapping ${i + 1}: not an object`);
			continue;
		}

		const m = raw as Record<string, unknown>;

		// targetFolder is required (sourceFolder is expected empty from export)
		if (typeof m.targetFolder !== "string" || !m.targetFolder.trim()) {
			errors.push(
				`Mapping ${i + 1}: missing targetFolder`
			);
			continue;
		}

		// Build a valid mapping, filling defaults for missing fields
		const mapping: FolderMapping = {
			...DEFAULT_MAPPING_VALUES,
			id: typeof m.id === "string" ? m.id : crypto.randomUUID?.() ?? String(Date.now()),
			enabled: typeof m.enabled === "boolean" ? m.enabled : false,
			sourceFolder: typeof m.sourceFolder === "string" ? m.sourceFolder : "",
			targetFolder: m.targetFolder as string,
			description: typeof m.description === "string" ? m.description : "",
			watchSubfolders: typeof m.watchSubfolders === "boolean" ? m.watchSubfolders : DEFAULT_MAPPING_VALUES.watchSubfolders,
			fileExtensions: Array.isArray(m.fileExtensions) ? m.fileExtensions.filter((e): e is string => typeof e === "string") : [],
			conflictResolution: isConflictResolution(m.conflictResolution) ? m.conflictResolution : DEFAULT_MAPPING_VALUES.conflictResolution,
			debounceDelay: typeof m.debounceDelay === "number" ? m.debounceDelay : DEFAULT_MAPPING_VALUES.debounceDelay,
			usePolling: typeof m.usePolling === "boolean" ? m.usePolling : DEFAULT_MAPPING_VALUES.usePolling,
			pollingInterval: typeof m.pollingInterval === "number" ? m.pollingInterval : DEFAULT_MAPPING_VALUES.pollingInterval,
			reconcileOnStart: typeof m.reconcileOnStart === "boolean" ? m.reconcileOnStart : DEFAULT_MAPPING_VALUES.reconcileOnStart,
			syncDirection: isSyncDirection(m.syncDirection) ? m.syncDirection : DEFAULT_MAPPING_VALUES.syncDirection,
			reverseConflictResolution: isConflictResolution(m.reverseConflictResolution) ? m.reverseConflictResolution : DEFAULT_MAPPING_VALUES.reverseConflictResolution,
			excludePatterns: Array.isArray(m.excludePatterns) ? m.excludePatterns.filter((e): e is string => typeof e === "string") : [],
			deletionHandling: m.deletionHandling === "trash" ? "trash" : "ignore",
			detectMoves: typeof m.detectMoves === "boolean" ? m.detectMoves : DEFAULT_MAPPING_VALUES.detectMoves,
		};

		mappings.push(mapping);
	}

	return { mappings, errors };
}

/**
 * Prepares imported mappings for insertion into the settings.
 * - Assigns fresh UUIDs to avoid ID collisions
 * - Sets enabled=false (user must configure sourceFolder first)
 * - Filters out mappings whose targetFolder overlaps with existing ones
 */
export function prepareMappingsForImport(
	imported: FolderMapping[],
	existing: FolderMapping[]
): PrepareImportResult {
	const warnings: string[] = [];
	const result: FolderMapping[] = [];

	for (const m of imported) {
		// Check for overlapping target folders with existing mappings
		const overlap = findOverlappingTarget(m.targetFolder, existing);
		if (overlap) {
			warnings.push(
				`Skipped "${m.description || m.targetFolder}": target folder overlaps with existing mapping "${overlap.description || overlap.id}"`
			);
			continue;
		}

		// Also check against already-accepted imports in this batch
		const batchOverlap = findOverlappingTarget(m.targetFolder, result);
		if (batchOverlap) {
			warnings.push(
				`Skipped "${m.description || m.targetFolder}": duplicate target folder in import file`
			);
			continue;
		}

		result.push({
			...m,
			id: crypto.randomUUID?.() ?? String(Date.now()),
			enabled: false,
		});
	}

	return { mappings: result, warnings };
}

function findOverlappingTarget(
	targetFolder: string,
	mappings: FolderMapping[]
): FolderMapping | undefined {
	const t1 = targetFolder.replace(/\\/g, "/").replace(/\/$/, "");
	return mappings.find((other) => {
		const t2 = other.targetFolder.replace(/\\/g, "/").replace(/\/$/, "");
		return t1 === t2 || t1.startsWith(t2 + "/") || t2.startsWith(t1 + "/");
	});
}

function isConflictResolution(v: unknown): v is FolderMapping["conflictResolution"] {
	return v === "overwrite" || v === "rename" || v === "skip" || v === "keepNewer";
}

function isSyncDirection(v: unknown): v is FolderMapping["syncDirection"] {
	return v === "source-only" || v === "vault-only" || v === "bidirectional";
}
