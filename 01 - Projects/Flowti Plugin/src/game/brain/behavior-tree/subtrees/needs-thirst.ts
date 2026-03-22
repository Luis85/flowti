/**
 * needs-thirst.ts — MDSL subtree for thirst satisfaction.
 *
 * When thirst is low, agent seeks a drink station and drinks.
 * Quirk-based preferences are tried first (e.g. coffee-addict → CoffeeMachine),
 * falling back to nearest available station.
 */

export const NEEDS_THIRST_SUBTREE = `
root [NeedsThirst] {
	sequence {
		condition [IsThirsty]
		selector {
			sequence {
				condition [HasPreferredDrinkStation]
				action [SeekPreferredDrinkStation]
			}
			action [SeekDrinkStation]
		}
		action [Drink]
	}
}
`.trim();
