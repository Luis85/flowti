/**
 * GURPS Dice Utility
 * Implements the 3d6 roll-under mechanic with critical success/failure rules
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export type RollOutcome = 
  | 'critical-success' 
  | 'success' 
  | 'failure' 
  | 'critical-failure';

export interface GurpsRollInput {
  /** Target number (effective skill level after all modifiers) */
  targetNumber: number;
  /** Optional modifier to apply to the roll (positive = harder, negative = easier) */
  modifier?: number;
  /** Optional description for logging/tracking */
  description?: string;
}

export interface DiceResult {
  /** The final outcome of the roll */
  outcome: RollOutcome;
  /** Whether the roll was successful (includes critical success) */
  isSuccess: boolean;
  /** Whether the result was critical (success or failure) */
  isCritical: boolean;
  /** Individual die results [d1, d2, d3] */
  dice: [number, number, number];
  /** Sum of all dice */
  total: number;
  /** Effective target after modifiers */
  effectiveTarget: number;
  /** Original target before modifiers */
  originalTarget: number;
  /** Applied modifier */
  modifier: number;
  /** Margin of success (positive) or failure (negative) */
  margin: number;
  /** Human-readable description of the result */
  summary: string;
}

export interface GurpsFrameworkConfig {
  /** 
   * Threshold: rolls at or below this are always critical success 
   * Default: 4 (GURPS standard: 3-4 always critical)
   */
  alwaysCriticalSuccessMax: number;
  
  /** 
   * Skill threshold for 5 being a critical success
   * Default: 15 (GURPS standard)
   */
  criticalOn5SkillMin: number;
  
  /** 
   * Skill threshold for 6 being a critical success
   * Default: 16 (GURPS standard)
   */
  criticalOn6SkillMin: number;
  
  /** 
   * Threshold: rolls at or above this are always critical failure
   * Default: 18 (GURPS standard)
   */
  alwaysCriticalFailureMin: number;
  
  /** 
   * Skill threshold at or below which 17 is a critical failure
   * Default: 15 (GURPS standard)
   */
  criticalOn17SkillMax: number;
  
  /** 
   * Margin threshold: failing by this much or more is critical
   * Default: 10 (GURPS standard)
   */
  criticalFailureMargin: number;
  
  /** 
   * Number of dice to roll
   * Default: 3 (GURPS standard)
   */
  diceCount: number;
  
  /** 
   * Sides per die
   * Default: 6 (GURPS standard)
   */
  diceSides: number;
}

// ============================================================================
// Default Configuration (GURPS 4th Edition Standard)
// ============================================================================

const DEFAULT_CONFIG: GurpsFrameworkConfig = {
  alwaysCriticalSuccessMax: 4,
  criticalOn5SkillMin: 15,
  criticalOn6SkillMin: 16,
  alwaysCriticalFailureMin: 18,
  criticalOn17SkillMax: 15,
  criticalFailureMargin: 10,
  diceCount: 3,
  diceSides: 6,
};

// ============================================================================
// GurpsDice Class
// ============================================================================

export class GurpsDice {
  private config: GurpsFrameworkConfig;

  constructor(config: Partial<GurpsFrameworkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Configuration Accessors
  // --------------------------------------------------------------------------

  getConfig(): Readonly<GurpsFrameworkConfig> {
    return { ...this.config };
  }

  updateConfig(updates: Partial<GurpsFrameworkConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  // --------------------------------------------------------------------------
  // Core Rolling Logic
  // --------------------------------------------------------------------------

  /**
   * Roll dice and return raw results
   */
  private rollDice(): number[] {
    const results: number[] = [];
    for (let i = 0; i < this.config.diceCount; i++) {
      results.push(Math.floor(Math.random() * this.config.diceSides) + 1);
    }
    return results;
  }

  /**
   * Determine if a roll is a critical success
   */
  private isCriticalSuccess(total: number, effectiveTarget: number): boolean {
    const { alwaysCriticalSuccessMax, criticalOn5SkillMin, criticalOn6SkillMin } = this.config;

    // Always critical on 3-4 (or configured threshold)
    if (total <= alwaysCriticalSuccessMax) return true;

    // Critical on 5 if skill >= 15
    if (total === 5 && effectiveTarget >= criticalOn5SkillMin) return true;

    // Critical on 6 if skill >= 16
    if (total === 6 && effectiveTarget >= criticalOn6SkillMin) return true;

    return false;
  }

  /**
   * Determine if a roll is a critical failure
   */
  private isCriticalFailure(total: number, effectiveTarget: number): boolean {
    const { alwaysCriticalFailureMin, criticalOn17SkillMax, criticalFailureMargin } = this.config;

    // Always critical failure on 18
    if (total >= alwaysCriticalFailureMin) return true;

    // Critical on 17 if skill <= 15
    if (total === 17 && effectiveTarget <= criticalOn17SkillMax) return true;

    // Critical if margin of failure >= 10
    const margin = effectiveTarget - total;
    if (margin <= -criticalFailureMargin) return true;

    return false;
  }

  /**
   * Determine the outcome of a roll
   */
  private determineOutcome(total: number, effectiveTarget: number): RollOutcome {
    const basicSuccess = total <= effectiveTarget;
    const critSuccess = this.isCriticalSuccess(total, effectiveTarget);
    const critFailure = this.isCriticalFailure(total, effectiveTarget);

    // Critical success takes priority (even beats critical failure on edge cases)
    if (critSuccess && basicSuccess) return 'critical-success';
    
    // Critical failure
    if (critFailure) return 'critical-failure';
    
    // Normal success/failure
    return basicSuccess ? 'success' : 'failure';
  }

  /**
   * Generate a human-readable summary
   */
  private generateSummary(result: Omit<DiceResult, 'summary'>): string {
    const diceStr = result.dice.join(' + ');
    const targetStr = result.modifier !== 0 
      ? `${result.originalTarget} ${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.effectiveTarget}`
      : `${result.effectiveTarget}`;
    
    const outcomeLabels: Record<RollOutcome, string> = {
      'critical-success': 'KRITISCHER ERFOLG',
      'success': 'Erfolg',
      'failure': 'Fehlschlag',
      'critical-failure': 'KRITISCHER FEHLSCHLAG',
    };

    const marginStr = result.margin >= 0 
      ? `+${result.margin}` 
      : `${result.margin}`;

    return `[${diceStr}] = ${result.total} vs. ${targetStr} → ${outcomeLabels[result.outcome]} (${marginStr})`;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Perform a GURPS skill roll
   */
  roll(input: GurpsRollInput): DiceResult {
    const modifier = input.modifier ?? 0;
    const effectiveTarget = input.targetNumber + modifier;
    
    const diceRolls = this.rollDice();
    const total = diceRolls.reduce((sum, die) => sum + die, 0);
    
    const outcome = this.determineOutcome(total, effectiveTarget);
    const margin = effectiveTarget - total;

    const result: Omit<DiceResult, 'summary'> = {
      outcome,
      isSuccess: outcome === 'critical-success' || outcome === 'success',
      isCritical: outcome === 'critical-success' || outcome === 'critical-failure',
      dice: diceRolls as [number, number, number],
      total,
      effectiveTarget,
      originalTarget: input.targetNumber,
      modifier,
      margin,
    };

    return {
      ...result,
      summary: this.generateSummary(result),
    };
  }

  /**
   * Perform a quick contest (both sides roll, compare margins)
   */
  quickContest(
    attacker: GurpsRollInput, 
    defender: GurpsRollInput
  ): { attacker: DiceResult; defender: DiceResult; winner: 'attacker' | 'defender' | 'tie' } {
    const attackerResult = this.roll(attacker);
    const defenderResult = this.roll(defender);

    let winner: 'attacker' | 'defender' | 'tie';
    
    if (attackerResult.margin > defenderResult.margin) {
      winner = 'attacker';
    } else if (defenderResult.margin > attackerResult.margin) {
      winner = 'defender';
    } else {
      winner = 'tie';
    }

    return { attacker: attackerResult, defender: defenderResult, winner };
  }

  /**
   * Calculate success probability for a given target number
   */
  getSuccessProbability(targetNumber: number): number {
    // For 3d6, calculate probability of rolling <= target
    let successCount = 0;
    const sides = this.config.diceSides;
    const dice = this.config.diceCount;
    const totalOutcomes = Math.pow(sides, dice);

    // Brute force for accuracy (works well for 3d6)
    for (let d1 = 1; d1 <= sides; d1++) {
      for (let d2 = 1; d2 <= sides; d2++) {
        for (let d3 = 1; d3 <= sides; d3++) {
          if (d1 + d2 + d3 <= targetNumber) {
            successCount++;
          }
        }
      }
    }

    return successCount / totalOutcomes;
  }

  /**
   * Get statistics for the current dice configuration
   */
  getStats(): { min: number; max: number; average: number; median: number } {
    const { diceCount, diceSides } = this.config;
    return {
      min: diceCount,
      max: diceCount * diceSides,
      average: diceCount * (diceSides + 1) / 2,
      median: diceCount * (diceSides + 1) / 2, // For 3d6, mean ≈ median
    };
  }
}

// ============================================================================
// Convenience Export
// ============================================================================

/** Pre-configured instance with GURPS 4e standard rules */
export const gurpsDice = new GurpsDice();
