/**
 * GDD balance constants — single source of truth for all numeric ranges and enums.
 *
 * Schemas, tests, and tick systems all import from here.
 * To rebalance: change the constant, everything else follows.
 */

export const ATTRIBUTE_RANGE = { min: 1, max: 20 } as const;
export const STATUS_RANGE = { min: -4, max: 8 } as const;
export const REPUTATION_RANGE = { min: -4, max: 4 } as const;
export const CHARISMA_RANGE = { min: 1, max: 20 } as const;
export const NEED_RANGE = { min: 0, max: 100 } as const;
export const MOOD_RANGE = { min: -100, max: 100 } as const;
export const MOOD_DEFAULT = 50;
export const SIGNIFICANCE_RANGE = { min: 1, max: 10 } as const;
export const USE_BONUS_RANGE = { min: 0, max: 3 } as const;
export const LLM_TEMPERATURE_RANGE = { min: 0, max: 2 } as const;

/** Social intentionally excluded — not a survival need; discomfort only. */
export const NEED_CRITICAL_THRESHOLDS = { hunger: 20, energy: 15, thirst: 20 } as const;

export const PERSONAL_THRESHOLD_CAP = 90;

export const TRAIT_CATEGORIES = ['survival', 'social', 'economic', 'work', 'special'] as const;
export const TRAIT_ASSIGNABLE_BY = ['director', 'definition', 'milestone', 'inherited'] as const;
export const GOAL_TYPES = ['aspirational', 'operational'] as const;
export const GOAL_PRIORITIES = ['high', 'medium', 'low'] as const;
export const MEMORY_OUTCOMES = ['positive', 'negative', 'neutral'] as const;
