import type { Module } from '../domain/shared/module.js';
import { isOk } from '../domain/shared/result.js';
import { topologicalSort } from '../domain/shared/utils/topo-sort.js';

/**
 * Pure validation pass over a module set.  Returns the collected error
 * messages and (on success) the topologically-sorted module list.
 *
 * Extracted from PluginCore to keep the core class focused on lifecycle;
 * the checks themselves have no instance-state dependencies beyond the
 * module list.
 */
export function validateModules(modules: readonly Module[]): {
	errors: readonly string[];
	sorted: readonly Module[];
} {
	const errors: string[] = [
		...checkDuplicateIds(modules),
		...checkDuplicateSettingsKeys(modules),
		...checkReservedSettingsKeys(modules),
		...checkDuplicateCommandIds(modules),
	];

	const sortResult = topologicalSort(modules, (m) => m.id, (m) => m.dependsOn ?? []);
	const sorted: readonly Module[] = isOk(sortResult) ? sortResult.value : [];
	if (!isOk(sortResult)) errors.push(sortResult.error);

	return { errors, sorted };
}

function checkDuplicateIds(modules: readonly Module[]): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();
	for (const m of modules) {
		if (seen.has(m.id)) errors.push(`duplicate module id "${m.id}"`);
		seen.add(m.id);
	}
	return errors;
}

function checkDuplicateSettingsKeys(modules: readonly Module[]): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();
	for (const m of modules) {
		if (m.settingsKey === undefined) continue;
		if (seen.has(m.settingsKey)) errors.push(`duplicate settingsKey "${m.settingsKey}"`);
		seen.add(m.settingsKey);
	}
	return errors;
}

function checkReservedSettingsKeys(modules: readonly Module[]): string[] {
	// PluginCore owns the "core" settings section (logLevel, locale, etc.)
	// No module may claim it.
	const errors: string[] = [];
	for (const m of modules) {
		if (m.settingsKey === 'core') {
			errors.push(`module "${m.id}" cannot use reserved settingsKey "core"`);
		}
	}
	return errors;
}

function checkDuplicateCommandIds(modules: readonly Module[]): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();
	for (const m of modules) {
		for (const cmd of m.commands ?? []) {
			if (seen.has(cmd.id)) errors.push(`duplicate command id "${cmd.id}"`);
			seen.add(cmd.id);
		}
	}
	return errors;
}
