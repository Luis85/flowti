import { Result, type ResultValue } from '../core/result.js';

export interface TraitEffect {
	system: string;
	modifier: Record<string, unknown>;
}

export interface TraitDefinition {
	id: string;
	effects: TraitEffect[];
	conflicts_with: string[];
}

export type ModifierMap = Record<string, Record<string, unknown>>;

function findConflict(traits: TraitDefinition[]): ResultValue<void> {
	for (let i = 0; i < traits.length; i++) {
		for (let j = i + 1; j < traits.length; j++) {
			const a = traits[i];
			const b = traits[j];
			if (a !== undefined && b !== undefined) {
				if (a.conflicts_with.includes(b.id) || b.conflicts_with.includes(a.id)) {
					return Result.err({
						code: 'TRAIT_CONFLICT',
						message: `Trait conflict: ${a.id} conflicts with ${b.id}`,
						system: 'TraitResolverSystem',
						recoverable: true,
						context: { traitA: a.id, traitB: b.id },
					});
				}
			}
		}
	}
	return Result.ok(undefined);
}

export function resolveTraitModifiers(
	agentTraitIds: string[],
	traitDefinitions: Record<string, TraitDefinition>,
): ResultValue<ModifierMap> {
	const activeTraits: TraitDefinition[] = [];

	for (const id of agentTraitIds) {
		const def = traitDefinitions[id];
		if (def === undefined) continue;
		activeTraits.push(def);
	}

	const conflictCheck = findConflict(activeTraits);
	if (!conflictCheck.ok) {
		return Result.err(conflictCheck.error);
	}

	const modifierMap: ModifierMap = {};

	for (const trait of activeTraits) {
		for (const effect of trait.effects) {
			const existing = modifierMap[effect.system] ?? {};
			modifierMap[effect.system] = { ...existing, ...effect.modifier };
		}
	}

	return Result.ok(modifierMap);
}
