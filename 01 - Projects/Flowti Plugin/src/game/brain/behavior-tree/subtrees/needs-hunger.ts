/**
 * needs-hunger.ts — MDSL subtree for hunger satisfaction.
 *
 * When hunger is low, agent seeks a food station and eats.
 * Quirk-based preferences are tried first (e.g. snacker → SnackTable),
 * falling back to nearest available station.
 */

export const NEEDS_HUNGER_SUBTREE = `
root [NeedsHunger] {
	sequence {
		condition [IsHungry]
		selector {
			sequence {
				condition [HasPreferredFoodStation]
				action [SeekPreferredFoodStation]
			}
			action [SeekFoodStation]
		}
		action [Eat]
	}
}
`.trim();
