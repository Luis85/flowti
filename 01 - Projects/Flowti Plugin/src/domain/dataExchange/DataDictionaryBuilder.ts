/**
 * Pure function that aggregates property usage across all configs
 * into a sorted DataDictionaryEntry array.
 *
 * Extracted from DataExchangeService to reduce its LOC.
 */

import type { DataExchangeState, DataDictionaryEntry } from "./types";

export function buildDataDictionary(state: Readonly<DataExchangeState>): DataDictionaryEntry[] {
	const map = new Map<string, DataDictionaryEntry>();

	const getOrCreate = (name: string): DataDictionaryEntry => {
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
	};

	const tagType = (entry: DataDictionaryEntry, typeName: string): void => {
		if (!entry.typeNames) entry.typeNames = [];
		if (!entry.typeNames.includes(typeName)) entry.typeNames.push(typeName);
	};

	for (const cfg of state.savedImportConfigs) {
		for (const m of cfg.columnMappings) {
			if (!m.included) continue;
			const entry = getOrCreate(m.frontmatterKey);
			entry.usedInConfigs.push({
				configId: cfg.id,
				configName: cfg.name,
				configType: "import",
			});
			if (!entry.csvColumnNames.includes(m.csvColumn)) {
				entry.csvColumnNames.push(m.csvColumn);
			}
			if (cfg.noteType) tagType(entry, cfg.noteType);
		}
		if (cfg.customProperties) {
			for (const [key, value] of Object.entries(cfg.customProperties)) {
				const entry = getOrCreate(key);
				entry.usedInConfigs.push({
					configId: cfg.id,
					configName: cfg.name,
					configType: "import",
				});
				if (value && entry.sampleValues.length < 5 && !entry.sampleValues.includes(value)) {
					entry.sampleValues.push(value);
				}
				if (cfg.noteType) tagType(entry, cfg.noteType);
			}
		}
	}

	for (const cfg of state.savedExportConfigs) {
		for (const col of cfg.columns) {
			const entry = getOrCreate(col);
			entry.usedInConfigs.push({
				configId: cfg.id,
				configName: cfg.name,
				configType: "export",
			});
			if (cfg.noteType) tagType(entry, cfg.noteType);
		}
	}

	for (const pipe of state.savedPipelines ?? []) {
		const mergeEntry = getOrCreate(pipe.mergeKey);
		if (pipe.noteType) tagType(mergeEntry, pipe.noteType);
		for (const src of pipe.sources) {
			if (!mergeEntry.csvColumnNames.includes(src.mergeKeyColumn)) {
				mergeEntry.csvColumnNames.push(src.mergeKeyColumn);
			}
			if (!mergeEntry.usedInConfigs.some((c) => c.configId === pipe.id)) {
				mergeEntry.usedInConfigs.push({
					configId: pipe.id,
					configName: pipe.name,
					configType: "import",
				});
			}
			for (const m of src.columnMappings) {
				if (!m.included) continue;
				const entry = getOrCreate(m.frontmatterKey);
				if (pipe.noteType) tagType(entry, pipe.noteType);
				if (!entry.usedInConfigs.some((c) => c.configId === pipe.id)) {
					entry.usedInConfigs.push({
						configId: pipe.id,
						configName: pipe.name,
						configType: "import",
					});
				}
				if (!entry.csvColumnNames.includes(m.csvColumn)) {
					entry.csvColumnNames.push(m.csvColumn);
				}
			}
			if (src.customProperties) {
				for (const [key, value] of Object.entries(src.customProperties)) {
					const entry = getOrCreate(key);
					if (pipe.noteType) tagType(entry, pipe.noteType);
					if (!entry.usedInConfigs.some((c) => c.configId === pipe.id)) {
						entry.usedInConfigs.push({
							configId: pipe.id,
							configName: pipe.name,
							configType: "import",
						});
					}
					if (value && entry.sampleValues.length < 5 && !entry.sampleValues.includes(value)) {
						entry.sampleValues.push(value);
					}
				}
			}
		}
	}

	return [...map.values()].sort((a, b) =>
		a.propertyName.localeCompare(b.propertyName),
	);
}
