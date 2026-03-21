/**
 * Pure function that aggregates property usage across all configs
 * into a sorted DataDictionaryEntry array.
 *
 * Extracted from DataExchangeService to reduce its LOC.
 */

import type { DataExchangeState, DataDictionaryEntry } from "./types";

type EntryMap = Map<string, DataDictionaryEntry>;

function getOrCreate(map: EntryMap, name: string): DataDictionaryEntry {
	let entry = map.get(name);
	if (!entry) {
		entry = {
			propertyName: name,
			usedInConfigs: [],
			csvColumnNames: [],
			sampleValues: [],
		};
		map.set(name, entry);
	}
	return entry;
}

function tagType(entry: DataDictionaryEntry, typeName: string): void {
	if (!entry.typeNames) entry.typeNames = [];
	if (!entry.typeNames.includes(typeName)) entry.typeNames.push(typeName);
}

function addSampleValue(entry: DataDictionaryEntry, value: string): void {
	if (value && entry.sampleValues.length < 5 && !entry.sampleValues.includes(value)) {
		entry.sampleValues.push(value);
	}
}

function addCsvColumn(entry: DataDictionaryEntry, csvColumn: string): void {
	if (!entry.csvColumnNames.includes(csvColumn)) {
		entry.csvColumnNames.push(csvColumn);
	}
}

function addConfigRef(entry: DataDictionaryEntry, configId: string, configName: string, configType: "import" | "export", dedupe = false): void {
	if (dedupe && entry.usedInConfigs.some((c) => c.configId === configId)) return;
	entry.usedInConfigs.push({ configId, configName, configType });
}

/** Process import configs into the dictionary map. */
function processImportConfigs(map: EntryMap, state: Readonly<DataExchangeState>): void {
	for (const cfg of state.savedImportConfigs) {
		for (const m of cfg.columnMappings) {
			if (!m.included) continue;
			const entry = getOrCreate(map, m.frontmatterKey);
			addConfigRef(entry, cfg.id, cfg.name, "import");
			addCsvColumn(entry, m.csvColumn);
			if (cfg.noteType) tagType(entry, cfg.noteType);
		}
		if (cfg.customProperties) {
			for (const [key, value] of Object.entries(cfg.customProperties)) {
				const entry = getOrCreate(map, key);
				addConfigRef(entry, cfg.id, cfg.name, "import");
				addSampleValue(entry, value);
				if (cfg.noteType) tagType(entry, cfg.noteType);
			}
		}
	}
}

/** Process export configs into the dictionary map. */
function processExportConfigs(map: EntryMap, state: Readonly<DataExchangeState>): void {
	for (const cfg of state.savedExportConfigs) {
		for (const col of cfg.columns) {
			const entry = getOrCreate(map, col);
			addConfigRef(entry, cfg.id, cfg.name, "export");
			if (cfg.noteType) tagType(entry, cfg.noteType);
		}
	}
}

/** Process pipelines into the dictionary map. */
function processPipelines(map: EntryMap, state: Readonly<DataExchangeState>): void {
	for (const pipe of state.savedPipelines ?? []) {
		const mergeEntry = getOrCreate(map, pipe.mergeKey);
		if (pipe.noteType) tagType(mergeEntry, pipe.noteType);
		for (const src of pipe.sources) {
			addCsvColumn(mergeEntry, src.mergeKeyColumn);
			addConfigRef(mergeEntry, pipe.id, pipe.name, "import", true);
			for (const m of src.columnMappings) {
				if (!m.included) continue;
				const entry = getOrCreate(map, m.frontmatterKey);
				if (pipe.noteType) tagType(entry, pipe.noteType);
				addConfigRef(entry, pipe.id, pipe.name, "import", true);
				addCsvColumn(entry, m.csvColumn);
			}
			if (src.customProperties) {
				for (const [key, value] of Object.entries(src.customProperties)) {
					const entry = getOrCreate(map, key);
					if (pipe.noteType) tagType(entry, pipe.noteType);
					addConfigRef(entry, pipe.id, pipe.name, "import", true);
					addSampleValue(entry, value);
				}
			}
		}
	}
}

export function buildDataDictionary(state: Readonly<DataExchangeState>): DataDictionaryEntry[] {
	const map: EntryMap = new Map();

	processImportConfigs(map, state);
	processExportConfigs(map, state);
	processPipelines(map, state);

	return [...map.values()].sort((a, b) =>
		a.propertyName.localeCompare(b.propertyName),
	);
}
