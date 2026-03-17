
import { gurpsDice, GurpsRollInput, GurpsFrameworkConfig, GurpsDice } from "./TheDice";

export function dicePlayground() {
	/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    GURPS DICE UTILITY - DOCUMENTATION                     ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Vollständige Dokumentation zur Bedienung, Konfiguration und Anpassung    ║
 * ║  des GURPS Würfelsystems für verschiedene Spielszenarien.                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

/**
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │                                                                           │
 * │  INHALTSVERZEICHNIS                                                       │
 * │                                                                           │
 * │  1. GRUNDKONZEPT: Das GURPS 3d6 System                                    │
 * │  2. INPUT INTERFACE: GurpsRollInput                                       │
 * │  3. OUTPUT INTERFACE: DiceResult                                          │
 * │  4. KONFIGURATION: GurpsFrameworkConfig                                   │
 * │  5. SZENARIEN                                                             │
 * │     5.1 Einfache Fertigkeitsproben                                        │
 * │     5.2 Modifizierte Würfe (Situationsmodifikatoren)                      │
 * │     5.3 Kritische Erfolge und Fehlschläge                                 │
 * │     5.4 Quick Contests (Vergleichende Proben)                             │
 * │     5.5 Kampfsituationen                                                  │
 * │     5.6 Cinematic Mode (Heroisches Spiel)                                 │
 * │     5.7 Hardcore Mode (Realismus)                                         │
 * │     5.8 Wahrscheinlichkeitsanalyse                                        │
 * │     5.9 Batch-Rolling und Statistik                                       │
 * │                                                                           │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

// =============================================================================
// 1. GRUNDKONZEPT: Das GURPS 3d6 System
// =============================================================================
/**
 * GURPS verwendet ein "Roll Under" System mit 3d6:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ERFOLG:     Würfelergebnis ≤ Zielwert (Effective Skill)               │
 * │  FEHLSCHLAG: Würfelergebnis > Zielwert                                  │
 * │  MARGIN:     Zielwert - Würfelergebnis (positiv = Erfolg)              │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Die Glockenkurve von 3d6 erzeugt eine Verteilung von 3-18 mit:
 * - Minimum: 3  (Wahrscheinlichkeit: 0.46%)
 * - Maximum: 18 (Wahrscheinlichkeit: 0.46%)
 * - Durchschnitt: 10.5
 * - Median: 10 oder 11
 * 
 * Dies bedeutet: Werte nahe 10-11 sind häufig, Extreme sind selten.
 * Ein Skill von 10 hat ~50% Erfolgswahrscheinlichkeit.
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('  1. GRUNDKONZEPT - 3d6 Statistik');
console.log('═══════════════════════════════════════════════════════════════\n');

const stats = gurpsDice.getStats();
console.log('3d6 Würfelstatistik:');
console.log(`  Minimum:      ${stats.min}`);
console.log(`  Maximum:      ${stats.max}`);
console.log(`  Durchschnitt: ${stats.average}`);
console.log(`  Median:       ${stats.median}`);

// =============================================================================
// 2. INPUT INTERFACE: GurpsRollInput
// =============================================================================
/**
 * Das GurpsRollInput Interface definiert die Eingabeparameter für einen Wurf:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PARAMETER       │ TYP      │ PFLICHT │ BESCHREIBUNG                   │
 * ├──────────────────┼──────────┼─────────┼────────────────────────────────┤
 * │  targetNumber    │ number   │ JA      │ Basis-Zielwert (Skill Level)   │
 * │  modifier        │ number   │ NEIN    │ Situationsmodifikator          │
 * │  description     │ string   │ NEIN    │ Beschreibung für Logging       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * TARGETUMBER (Zielwert):
 * Der Basiswert der Fertigkeit oder des Attributs. In GURPS typischerweise
 * zwischen 8 (untrainiert) und 20+ (Meister).
 * 
 * MODIFIER (Modifikator):
 * Situationsbedingte Anpassungen. Negative Werte erschweren die Probe,
 * positive erleichtern sie.
 * 
 * Typische Modifikatoren:
 *   +4  Sehr einfache Aufgabe
 *   +2  Einfache Aufgabe
 *    0  Normale Aufgabe
 *   -2  Schwierige Aufgabe
 *   -4  Sehr schwierige Aufgabe
 *   -6  Extrem schwierige Aufgabe
 *  -10  Fast unmöglich
 * 
 * BERECHNUNG:
 *   effectiveTarget = targetNumber + modifier
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  2. INPUT INTERFACE - GurpsRollInput');
console.log('═══════════════════════════════════════════════════════════════\n');

// Beispiel: Verschiedene Input-Konfigurationen
const inputExamples: GurpsRollInput[] = [
  { 
    targetNumber: 12, 
    description: 'Einfacher Skill-Check ohne Modifikator' 
  },
  { 
    targetNumber: 14, 
    modifier: -4, 
    description: 'Skill 14 mit -4 Erschwernis' 
  },
  { 
    targetNumber: 10, 
    modifier: +2, 
    description: 'Skill 10 mit +2 Erleichterung' 
  },
];

console.log('Input-Beispiele:\n');
inputExamples.forEach((input, i) => {
  const effective = input.targetNumber + (input.modifier ?? 0);
  console.log(`  ${i + 1}. ${input.description}`);
  console.log(`     targetNumber: ${input.targetNumber}`);
  console.log(`     modifier:     ${input.modifier ?? 0}`);
  console.log(`     → effective:  ${effective}\n`);
});

// =============================================================================
// 3. OUTPUT INTERFACE: DiceResult
// =============================================================================
/**
 * Das DiceResult Interface enthält alle Informationen über den Wurf:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  FELD            │ TYP                  │ BESCHREIBUNG                  │
 * ├──────────────────┼──────────────────────┼───────────────────────────────┤
 * │  outcome         │ RollOutcome          │ Kategorie des Ergebnisses     │
 * │  isSuccess       │ boolean              │ Erfolg (inkl. kritisch)?      │
 * │  isCritical      │ boolean              │ Kritisches Ergebnis?          │
 * │  dice            │ [number, number,     │ Einzelne Würfelergebnisse     │
 * │                  │  number]             │                               │
 * │  total           │ number               │ Summe aller Würfel            │
 * │  effectiveTarget │ number               │ Zielwert nach Modifikatoren   │
 * │  originalTarget  │ number               │ Ursprünglicher Zielwert       │
 * │  modifier        │ number               │ Angewandter Modifikator       │
 * │  margin          │ number               │ Erfolgsspanne (+ oder -)      │
 * │  summary         │ string               │ Lesbare Zusammenfassung       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * OUTCOME (Ergebnis-Kategorien):
 *   - 'critical-success'  : Kritischer Erfolg
 *   - 'success'           : Normaler Erfolg
 *   - 'failure'           : Normaler Fehlschlag
 *   - 'critical-failure'  : Kritischer Fehlschlag
 * 
 * MARGIN (Erfolgsspanne):
 *   margin = effectiveTarget - total
 *   - Positiv: Erfolg, je höher desto besser
 *   - Negativ: Fehlschlag, je niedriger desto schlimmer
 *   - Wird für Quick Contests und Schadensberechnung verwendet
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('  3. OUTPUT INTERFACE - DiceResult');
console.log('═══════════════════════════════════════════════════════════════\n');

const exampleResult = gurpsDice.roll({ targetNumber: 12 });

console.log('Beispiel-Ausgabe eines Wurfs:\n');
console.log('  outcome:         ', exampleResult.outcome);
console.log('  isSuccess:       ', exampleResult.isSuccess);
console.log('  isCritical:      ', exampleResult.isCritical);
console.log('  dice:            ', exampleResult.dice);
console.log('  total:           ', exampleResult.total);
console.log('  effectiveTarget: ', exampleResult.effectiveTarget);
console.log('  originalTarget:  ', exampleResult.originalTarget);
console.log('  modifier:        ', exampleResult.modifier);
console.log('  margin:          ', exampleResult.margin);
console.log('  summary:         ', exampleResult.summary);

// =============================================================================
// 4. KONFIGURATION: GurpsFrameworkConfig
// =============================================================================
/**
 * Die GurpsFrameworkConfig erlaubt die Anpassung aller GURPS-Regelparameter:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  KRITISCHE ERFOLGE                                                      │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  alwaysCriticalSuccessMax  │ Standard: 4  │ Würfe ≤ diesem Wert sind   │
 * │                            │              │ IMMER kritische Erfolge.   │
 * │                            │              │ (GURPS: 3-4 sind kritisch) │
 * ├────────────────────────────┼──────────────┼────────────────────────────┤
 * │  criticalOn5SkillMin       │ Standard: 15 │ Ab diesem Skillwert ist    │
 * │                            │              │ eine 5 ein krit. Erfolg.   │
 * ├────────────────────────────┼──────────────┼────────────────────────────┤
 * │  criticalOn6SkillMin       │ Standard: 16 │ Ab diesem Skillwert ist    │
 * │                            │              │ eine 6 ein krit. Erfolg.   │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  KRITISCHE FEHLSCHLÄGE                                                  │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  alwaysCriticalFailureMin  │ Standard: 18 │ Würfe ≥ diesem Wert sind   │
 * │                            │              │ IMMER kritische Fehler.    │
 * ├────────────────────────────┼──────────────┼────────────────────────────┤
 * │  criticalOn17SkillMax      │ Standard: 15 │ Unter diesem Skillwert ist │
 * │                            │              │ eine 17 ein krit. Fehler.  │
 * ├────────────────────────────┼──────────────┼────────────────────────────┤
 * │  criticalFailureMargin     │ Standard: 10 │ Fehlschlag um diese Margin │
 * │                            │              │ oder mehr = krit. Fehler.  │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  WÜRFEL-KONFIGURATION                                                   │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  diceCount                 │ Standard: 3  │ Anzahl der Würfel          │
 * │  diceSides                 │ Standard: 6  │ Seiten pro Würfel          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  4. KONFIGURATION - GurpsFrameworkConfig');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Standard GURPS 4e Konfiguration:\n');
const defaultConfig = gurpsDice.getConfig();
console.log('  KRITISCHE ERFOLGE:');
console.log(`    alwaysCriticalSuccessMax: ${defaultConfig.alwaysCriticalSuccessMax} (Würfe ≤${defaultConfig.alwaysCriticalSuccessMax} immer kritisch)`);
console.log(`    criticalOn5SkillMin:      ${defaultConfig.criticalOn5SkillMin} (5 kritisch bei Skill ≥${defaultConfig.criticalOn5SkillMin})`);
console.log(`    criticalOn6SkillMin:      ${defaultConfig.criticalOn6SkillMin} (6 kritisch bei Skill ≥${defaultConfig.criticalOn6SkillMin})`);
console.log('');
console.log('  KRITISCHE FEHLSCHLÄGE:');
console.log(`    alwaysCriticalFailureMin: ${defaultConfig.alwaysCriticalFailureMin} (Würfe ≥${defaultConfig.alwaysCriticalFailureMin} immer kritisch)`);
console.log(`    criticalOn17SkillMax:     ${defaultConfig.criticalOn17SkillMax} (17 kritisch bei Skill ≤${defaultConfig.criticalOn17SkillMax})`);
console.log(`    criticalFailureMargin:    ${defaultConfig.criticalFailureMargin} (Fehlschlag um ≥${defaultConfig.criticalFailureMargin} ist kritisch)`);
console.log('');
console.log('  WÜRFEL:');
console.log(`    diceCount: ${defaultConfig.diceCount}`);
console.log(`    diceSides: ${defaultConfig.diceSides}`);

// =============================================================================
// 5. SZENARIEN
// =============================================================================

// -----------------------------------------------------------------------------
// 5.1 Einfache Fertigkeitsproben
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Standard-Fertigkeitsproben
 * 
 * Die häufigste Anwendung: Prüfen, ob eine Aktion gelingt.
 * Der Spieler würfelt gegen seinen Fertigkeitswert.
 * 
 * ANWENDUNGSFÄLLE:
 * - Klettern, Schwimmen, Schleichen
 * - Handwerk, Reparaturen
 * - Wissensproben (Historie, Medizin, etc.)
 * - Soziale Interaktionen (Diplomatie, Einschüchtern)
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  5.1 SZENARIO - Einfache Fertigkeitsproben');
console.log('═══════════════════════════════════════════════════════════════\n');

const simpleChecks = [
  { targetNumber: 8, description: 'Ungeübter Versuch (Default)' },
  { targetNumber: 10, description: 'Basis-Ausbildung' },
  { targetNumber: 12, description: 'Kompetent' },
  { targetNumber: 14, description: 'Professionell' },
  { targetNumber: 16, description: 'Experte' },
  { targetNumber: 18, description: 'Meister' },
];

console.log('Beispiele verschiedener Skill-Stufen:\n');
simpleChecks.forEach(check => {
  const result = gurpsDice.roll(check);
  const prob = (gurpsDice.getSuccessProbability(check.targetNumber) * 100).toFixed(1);
  console.log(`  ${check.description} (Skill ${check.targetNumber}, ${prob}% Chance):`);
  console.log(`    → ${result.summary}\n`);
});

// -----------------------------------------------------------------------------
// 5.2 Modifizierte Würfe (Situationsmodifikatoren)
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Situationsabhängige Modifikatoren
 * 
 * Modifikatoren passen die Schwierigkeit an die Umstände an.
 * Sie werden zum Zielwert addiert (positiv = leichter, negativ = schwerer).
 * 
 * TYPISCHE MODIFIKATOREN:
 * 
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  AUSRÜSTUNG & WERKZEUG                                                │
 * │    +2  Hochwertige Ausrüstung                                         │
 * │    +1  Gute Ausrüstung                                                │
 * │     0  Standard-Ausrüstung                                            │
 * │    -2  Improvisierte Werkzeuge                                        │
 * │    -4  Keine passenden Werkzeuge                                      │
 * ├────────────────────────────────────────────────────────────────────────┤
 * │  SICHT & BELEUCHTUNG                                                  │
 * │    -1  Dämmerlicht                                                    │
 * │    -3  Schlechte Beleuchtung                                          │
 * │    -5  Nahezu dunkel                                                  │
 * │   -10  Totale Dunkelheit                                              │
 * ├────────────────────────────────────────────────────────────────────────┤
 * │  ZEITDRUCK                                                            │
 * │    +2  Doppelte Zeit                                                  │
 * │    +1  50% mehr Zeit                                                  │
 * │     0  Normale Zeit                                                   │
 * │    -2  Halbe Zeit                                                     │
 * │    -4  Viertel der Zeit                                               │
 * │    -6  Unter extremem Zeitdruck                                       │
 * ├────────────────────────────────────────────────────────────────────────┤
 * │  ABLENKUNG & STRESS                                                   │
 * │    -2  Leichte Ablenkung                                              │
 * │    -4  Starke Ablenkung / Stress                                      │
 * │    -6  Kampfsituation / Lebensgefahr                                  │
 * └────────────────────────────────────────────────────────────────────────┘
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('  5.2 SZENARIO - Situationsmodifikatoren');
console.log('═══════════════════════════════════════════════════════════════\n');

const baseSkill = 12;

const situations: GurpsRollInput[] = [
  { 
    targetNumber: baseSkill, 
    modifier: +4, 
    description: 'Ideale Bedingungen (+4)' 
  },
  { 
    targetNumber: baseSkill, 
    modifier: +2, 
    description: 'Gute Ausrüstung (+2)' 
  },
  { 
    targetNumber: baseSkill, 
    modifier: 0, 
    description: 'Normale Bedingungen' 
  },
  { 
    targetNumber: baseSkill, 
    modifier: -2, 
    description: 'Zeitdruck (-2)' 
  },
  { 
    targetNumber: baseSkill, 
    modifier: -4, 
    description: 'Dunkelheit (-4)' 
  },
  { 
    targetNumber: baseSkill, 
    modifier: -6, 
    description: 'Kampfsituation (-6)' 
  },
  { 
    targetNumber: baseSkill, 
    modifier: -10, 
    description: 'Fast unmöglich (-10)' 
  },
];

console.log(`Basis-Skill: ${baseSkill}\n`);
situations.forEach(sit => {
  const effective = sit.targetNumber + (sit.modifier ?? 0);
  const prob = (gurpsDice.getSuccessProbability(effective) * 100).toFixed(1);
  const result = gurpsDice.roll(sit);
  console.log(`  ${sit.description}`);
  console.log(`    Effektiv: ${effective}, Chance: ${prob}%`);
  console.log(`    → ${result.summary}\n`);
});

// Kombinierte Modifikatoren
console.log('  KOMBINIERTE MODIFIKATOREN:');
console.log('  Beispiel: Schloss knacken bei schlechtem Licht mit improvisierten Werkzeugen\n');

const combinedModifier: GurpsRollInput = {
  targetNumber: 14,               // Lockpicking Skill
  modifier: -3 + -2,              // Schlechtes Licht (-3) + Improvisation (-2)
  description: 'Lockpicking unter erschwerten Bedingungen',
};

const combinedResult = gurpsDice.roll(combinedModifier);
console.log(`    Skill: ${combinedModifier.targetNumber}`);
console.log(`    Modifikatoren: -3 (Licht) + -2 (Werkzeug) = -5`);
console.log(`    → ${combinedResult.summary}`);

// -----------------------------------------------------------------------------
// 5.3 Kritische Erfolge und Fehlschläge
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Kritische Ergebnisse
 * 
 * GURPS verwendet spezielle Regeln für außergewöhnliche Ergebnisse:
 * 
 * KRITISCHER ERFOLG (Standard-Regeln):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  Würfelergebnis │ Bedingung                                           │
 * ├─────────────────┼─────────────────────────────────────────────────────┤
 * │  3              │ IMMER kritischer Erfolg                             │
 * │  4              │ IMMER kritischer Erfolg                             │
 * │  5              │ Kritisch wenn Effective Skill ≥ 15                  │
 * │  6              │ Kritisch wenn Effective Skill ≥ 16                  │
 * └────────────────────────────────────────────────────────────────────────┘
 * 
 * KRITISCHER FEHLSCHLAG (Standard-Regeln):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  Würfelergebnis │ Bedingung                                           │
 * ├─────────────────┼─────────────────────────────────────────────────────┤
 * │  18             │ IMMER kritischer Fehlschlag                         │
 * │  17             │ Kritisch wenn Effective Skill ≤ 15                  │
 * │  Beliebig       │ Kritisch wenn Margin of Failure ≥ 10                │
 * └────────────────────────────────────────────────────────────────────────┘
 * 
 * AUSWIRKUNGEN KRITISCHER ERGEBNISSE:
 * 
 * Kritischer Erfolg:
 * - Aufgabe gelingt besonders gut
 * - Im Kampf: Automatischer maximaler Schaden oder Spezialeffekt
 * - Bei Zauber: Doppelte Wirkung oder halber Energieverbrauch
 * 
 * Kritischer Fehlschlag:
 * - Waffe fällt, bricht, oder verletzt den Anwender
 * - Zauber schlägt fehl und hat negative Konsequenzen
 * - Soziale Situation eskaliert dramatisch
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  5.3 SZENARIO - Kritische Erfolge und Fehlschläge');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('KRITISCHE ERFOLGE - Skill-Abhängigkeit:\n');

const critSuccessTests = [
  { skill: 10, note: 'Nur 3-4 sind kritisch' },
  { skill: 15, note: '3-5 sind kritisch' },
  { skill: 16, note: '3-6 sind kritisch' },
  { skill: 20, note: '3-6 sind kritisch (max)' },
];

critSuccessTests.forEach(test => {
  console.log(`  Skill ${test.skill}: ${test.note}`);
});

console.log('\n  Simulations-Beispiele (je 5 Würfe bei Skill 16):\n');
for (let i = 0; i < 5; i++) {
  const result = gurpsDice.roll({ targetNumber: 16 });
  const critMark = result.isCritical ? (result.isSuccess ? '★ KRIT!' : '✗ PATZER!') : '';
  console.log(`    ${result.summary} ${critMark}`);
}

console.log('\n\nKRITISCHE FEHLSCHLÄGE - Margin-basiert:\n');
console.log('  Beispiel: Skill 8, Wurf 18 = Margin -10 → Kritischer Fehlschlag');

const marginFailExample = gurpsDice.roll({ targetNumber: 8 });
console.log(`  Aktueller Wurf: ${marginFailExample.summary}`);
console.log(`  Margin: ${marginFailExample.margin}`);
console.log(`  Kritisch: ${marginFailExample.isCritical ? 'JA' : 'Nein'}`);

// -----------------------------------------------------------------------------
// 5.4 Quick Contests (Vergleichende Proben)
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Vergleichende Proben (Quick Contests)
 * 
 * Wenn zwei Charaktere direkt gegeneinander antreten, würfeln beide
 * und vergleichen ihre Margins of Success.
 * 
 * ABLAUF:
 * 1. Beide Seiten würfeln gegen ihren jeweiligen Skill
 * 2. Margin = Effective Skill - Würfelergebnis
 * 3. Höhere Margin gewinnt
 * 4. Bei Gleichstand: Unentschieden (oder erneut würfeln)
 * 
 * ANWENDUNGSFÄLLE:
 * - Arm Wrestling (ST vs ST)
 * - Verhandlung (Merchant vs Merchant)
 * - Verstecken/Suchen (Stealth vs Perception)
 * - Wettrennen (Running vs Running)
 * - Kampf-Manöver (Skill vs Skill oder Skill vs Attribute)
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  5.4 SZENARIO - Quick Contests');
console.log('═══════════════════════════════════════════════════════════════\n');

// Beispiel 1: Stealth vs Perception
console.log('BEISPIEL 1: Schleichen vs Wahrnehmung\n');

const stealthContest = gurpsDice.quickContest(
  { targetNumber: 14, description: 'Dieb (Stealth 14)' },
  { targetNumber: 12, description: 'Wache (Perception 12)' }
);

console.log(`  Dieb:   ${stealthContest.attacker.summary}`);
console.log(`  Wache:  ${stealthContest.defender.summary}`);
console.log(`  → Gewinner: ${stealthContest.winner === 'attacker' ? 'Dieb bleibt unentdeckt' : 
                            stealthContest.winner === 'defender' ? 'Wache bemerkt den Dieb' : 
                            'Unentschieden - Wache ist misstrauisch'}\n`);

// Beispiel 2: Verhandlung
console.log('BEISPIEL 2: Preisverhandlung\n');

const merchantContest = gurpsDice.quickContest(
  { targetNumber: 13, modifier: +2, description: 'Spieler (Merchant 13, +2 für gute Argumente)' },
  { targetNumber: 15, description: 'Händler (Merchant 15)' }
);

console.log(`  Spieler: ${merchantContest.attacker.summary}`);
console.log(`  Händler: ${merchantContest.defender.summary}`);
console.log(`  → ${merchantContest.winner === 'attacker' ? 'Spieler bekommt einen Rabatt!' : 
                  merchantContest.winner === 'defender' ? 'Händler bleibt hart.' : 
                  'Beide einigen sich auf einen fairen Preis.'}\n`);

// Beispiel 3: Mehrere Contests
console.log('BEISPIEL 3: Arm-Wrestling Turnier (3 Runden)\n');

for (let round = 1; round <= 3; round++) {
  const armWrestle = gurpsDice.quickContest(
    { targetNumber: 12, description: 'Kämpfer A (ST 12)' },
    { targetNumber: 14, description: 'Kämpfer B (ST 14)' }
  );
  console.log(`  Runde ${round}:`);
  console.log(`    A: ${armWrestle.attacker.total} (Margin ${armWrestle.attacker.margin})`);
  console.log(`    B: ${armWrestle.defender.total} (Margin ${armWrestle.defender.margin})`);
  console.log(`    → ${armWrestle.winner === 'attacker' ? 'A gewinnt' : 
                      armWrestle.winner === 'defender' ? 'B gewinnt' : 'Patt'}\n`);
}

// -----------------------------------------------------------------------------
// 5.5 Kampfsituationen
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Kampf-Mechaniken
 * 
 * Im GURPS Kampfsystem werden verschiedene Arten von Würfen verwendet:
 * 
 * ANGRIFFSwurf:
 * - Würfeln gegen Waffenskill
 * - Erfolg bedeutet potentieller Treffer
 * - Margin kann für Angriffsoptionen verwendet werden
 * 
 * VERTEIDIGUNG:
 * - Parry: Waffenskill / 2 + 3
 * - Block: Schild-Skill / 2 + 3
 * - Dodge: Basic Speed + 3
 * 
 * SCHADENSBERECHNUNG:
 * - Basisschaden aus Stärke + Waffenmodifikator
 * - Bei kritischem Treffer: Maximaler Schaden oder Spezialeffekt
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('  5.5 SZENARIO - Kampfsituationen');
console.log('═══════════════════════════════════════════════════════════════\n');

// Kampfrunde simulieren
function simulateCombatRound(attackerSkill: number, defenderParry: number) {
  console.log(`Angreifer (Schwert ${attackerSkill}) vs Verteidiger (Parry ${defenderParry}):\n`);
  
  // Angriff
  const attack = gurpsDice.roll({ 
    targetNumber: attackerSkill, 
    description: 'Schwerthieb' 
  });
  console.log(`  1. Angriff: ${attack.summary}`);
  
  if (!attack.isSuccess) {
    console.log(`  → Angriff verfehlt!\n`);
    return;
  }
  
  if (attack.outcome === 'critical-success') {
    console.log(`  → KRITISCHER TREFFER! Keine Verteidigung möglich!\n`);
    return;
  }
  
  // Verteidigung nur bei erfolgreichem, nicht-kritischem Angriff
  const defense = gurpsDice.roll({ 
    targetNumber: defenderParry, 
    description: 'Parieren' 
  });
  console.log(`  2. Parade: ${defense.summary}`);
  
  if (defense.isSuccess) {
    console.log(`  → Angriff pariert!\n`);
  } else if (defense.outcome === 'critical-failure') {
    console.log(`  → KRITISCHER FEHLER bei der Parade! Waffe fällt!\n`);
  } else {
    console.log(`  → Treffer! Würfle Schaden...\n`);
  }
}

simulateCombatRound(14, 10);
simulateCombatRound(12, 12);

// Mehrere Angriffe
console.log('Deceptive Attack (Täuschender Angriff):\n');
console.log('  Regel: -2 auf eigenen Angriff gibt -1 auf Verteidigung des Gegners\n');

const deceptiveAttack = gurpsDice.roll({ 
  targetNumber: 16, 
  modifier: -4, // -4 für -2 auf Gegner-Verteidigung
  description: 'Deceptive Attack (-4)' 
});
console.log(`  Angriff: ${deceptiveAttack.summary}`);
console.log(`  Gegner-Parade wäre bei -2 Modifikator`);

// -----------------------------------------------------------------------------
// 5.6 Cinematic Mode (Heroisches Spiel)
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Cinematic / Heroisches Spiel
 * 
 * Für Action-lastige Kampagnen, in denen Helden übermenschlich kompetent sind.
 * Die Konfiguration wird angepasst für:
 * - Häufigere kritische Erfolge
 * - Seltenere kritische Fehlschläge
 * - Mehr "Heldenmomente"
 * 
 * KONFIGURATIONSÄNDERUNGEN:
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  Parameter                  │ Standard │ Cinematic │ Effekt            │
 * ├─────────────────────────────┼──────────┼───────────┼───────────────────┤
 * │  alwaysCriticalSuccessMax   │    4     │     5     │ 3-5 immer krit.   │
 * │  criticalOn5SkillMin        │   15     │    12     │ 5 krit. ab Sk. 12 │
 * │  criticalOn6SkillMin        │   16     │    14     │ 6 krit. ab Sk. 14 │
 * │  alwaysCriticalFailureMin   │   18     │    18     │ unverändert       │
 * │  criticalOn17SkillMax       │   15     │    10     │ 17 krit. nur ≤10  │
 * │  criticalFailureMargin      │   10     │    12     │ Schwerer zu patzen│
 * └────────────────────────────────────────────────────────────────────────┘
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  5.6 SZENARIO - Cinematic Mode');
console.log('═══════════════════════════════════════════════════════════════\n');

const cinematicConfig: Partial<GurpsFrameworkConfig> = {
  alwaysCriticalSuccessMax: 5,   // 3-5 immer kritisch
  criticalOn5SkillMin: 12,       // 5 kritisch ab Skill 12
  criticalOn6SkillMin: 14,       // 6 kritisch ab Skill 14
  criticalOn17SkillMax: 10,      // 17 nur kritischer Fehler bei Skill ≤10
  criticalFailureMargin: 12,     // Erst bei -12 kritischer Fehlschlag
};

const cinematicDice = new GurpsDice(cinematicConfig);

console.log('Cinematic Konfiguration:');
console.log(JSON.stringify(cinematicDice.getConfig(), null, 2));

console.log('\nVergleich: 10 Würfe mit Skill 12\n');

console.log('  STANDARD MODE:');
let stdCrits = 0;
for (let i = 0; i < 10; i++) {
  const result = gurpsDice.roll({ targetNumber: 12 });
  if (result.isCritical && result.isSuccess) stdCrits++;
  console.log(`    ${result.summary}`);
}

console.log(`  → Kritische Erfolge: ${stdCrits}\n`);

console.log('  CINEMATIC MODE:');
let cinCrits = 0;
for (let i = 0; i < 10; i++) {
  const result = cinematicDice.roll({ targetNumber: 12 });
  if (result.isCritical && result.isSuccess) cinCrits++;
  console.log(`    ${result.summary}`);
}
console.log(`  → Kritische Erfolge: ${cinCrits}`);

// -----------------------------------------------------------------------------
// 5.7 Hardcore Mode (Realismus)
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Hardcore / Realistisches Spiel
 * 
 * Für Kampagnen mit hoher Sterblichkeit und realistischen Konsequenzen.
 * Kritische Erfolge sind seltener, kritische Fehlschläge häufiger.
 * 
 * KONFIGURATIONSÄNDERUNGEN:
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  Parameter                  │ Standard │ Hardcore  │ Effekt            │
 * ├─────────────────────────────┼──────────┼───────────┼───────────────────┤
 * │  alwaysCriticalSuccessMax   │    4     │     3     │ Nur 3 immer krit. │
 * │  criticalOn5SkillMin        │   15     │    18     │ 5 krit. ab Sk. 18 │
 * │  criticalOn6SkillMin        │   16     │    20     │ 6 krit. ab Sk. 20 │
 * │  alwaysCriticalFailureMin   │   18     │    17     │ 17-18 immer krit. │
 * │  criticalOn17SkillMax       │   15     │    18     │ 17 krit. bis Sk.18│
 * │  criticalFailureMargin      │   10     │     8     │ -8 schon kritisch │
 * └────────────────────────────────────────────────────────────────────────┘
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  5.7 SZENARIO - Hardcore Mode');
console.log('═══════════════════════════════════════════════════════════════\n');

const hardcoreConfig: Partial<GurpsFrameworkConfig> = {
  alwaysCriticalSuccessMax: 3,   // Nur 3 ist garantiert kritisch
  criticalOn5SkillMin: 18,       // 5 kritisch erst ab Skill 18
  criticalOn6SkillMin: 20,       // 6 kritisch erst ab Skill 20
  alwaysCriticalFailureMin: 17,  // 17 und 18 immer kritisch
  criticalOn17SkillMax: 18,      // 17 kritisch bis Skill 18
  criticalFailureMargin: 8,      // Schon bei -8 kritischer Fehlschlag
};

const hardcoreDice = new GurpsDice(hardcoreConfig);

console.log('Hardcore Konfiguration:');
console.log(JSON.stringify(hardcoreDice.getConfig(), null, 2));

console.log('\nVergleich: Skill 14 Probe\n');

const probeSkill = 14;
console.log(`  Standard:  Krit. Erfolg bei 3-4, Krit. Fehler bei 18 oder Margin ≤-10`);
console.log(`  Hardcore:  Krit. Erfolg nur bei 3, Krit. Fehler bei 17-18 oder Margin ≤-8\n`);

console.log('  5 Würfe im Hardcore-Mode:');
for (let i = 0; i < 5; i++) {
  const result = hardcoreDice.roll({ targetNumber: probeSkill });
  console.log(`    ${result.summary}`);
}

// -----------------------------------------------------------------------------
// 5.8 Wahrscheinlichkeitsanalyse
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Wahrscheinlichkeitsberechnung
 * 
 * Die getSuccessProbability() Methode berechnet die exakte Erfolgswahrscheinlichkeit
 * für jeden Zielwert. Nützlich für:
 * - Charakteroptimierung
 * - Encounter-Balancing
 * - Regelverständnis
 * 
 * 3d6 WAHRSCHEINLICHKEITSTABELLE:
 * ┌────────────┬──────────────┬────────────────────────────────────────────┐
 * │  Zielwert  │  Erfolg %    │  Visualisierung                            │
 * ├────────────┼──────────────┼────────────────────────────────────────────┤
 * │     3      │    0.5%      │  ▏                                         │
 * │     4      │    1.9%      │  ▎                                         │
 * │     5      │    4.6%      │  ▌                                         │
 * │     6      │    9.3%      │  █                                         │
 * │     7      │   16.2%      │  █▋                                        │
 * │     8      │   25.9%      │  ██▌                                       │
 * │     9      │   37.5%      │  ███▊                                      │
 * │    10      │   50.0%      │  █████                                     │
 * │    11      │   62.5%      │  ██████▎                                   │
 * │    12      │   74.1%      │  ███████▍                                  │
 * │    13      │   83.8%      │  ████████▍                                 │
 * │    14      │   90.7%      │  █████████                                 │
 * │    15      │   95.4%      │  █████████▌                                │
 * │    16      │   98.1%      │  █████████▊                                │
 * │    17      │   99.5%      │  ██████████                                │
 * │    18      │  100.0%      │  ██████████                                │
 * └────────────┴──────────────┴────────────────────────────────────────────┘
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  5.8 SZENARIO - Wahrscheinlichkeitsanalyse');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Erfolgswahrscheinlichkeit nach Zielwert:\n');

function visualizeBar(percentage: number, maxWidth = 40): string {
  const filled = Math.round((percentage / 100) * maxWidth);
  return '█'.repeat(filled) + '░'.repeat(maxWidth - filled);
}

for (let target = 3; target <= 18; target++) {
  const prob = gurpsDice.getSuccessProbability(target) * 100;
  const bar = visualizeBar(prob);
  console.log(`  ${target.toString().padStart(2)}: ${bar} ${prob.toFixed(1).padStart(5)}%`);
}

// Praktische Anwendung
console.log('\nPRAKTISCHE ANWENDUNG: Skill-Empfehlungen\n');

const recommendations = [
  { min: 0, max: 25, advice: 'Vermeiden oder nur mit Unterstützung' },
  { min: 25, max: 50, advice: 'Riskant, nur wenn nötig' },
  { min: 50, max: 75, advice: 'Zuverlässig genug für wichtige Aufgaben' },
  { min: 75, max: 90, advice: 'Professionelles Niveau' },
  { min: 90, max: 100, advice: 'Meisterhaft, fast sichere Erfolge' },
];

recommendations.forEach(rec => {
  console.log(`  ${rec.min}-${rec.max}%: ${rec.advice}`);
});

// -----------------------------------------------------------------------------
// 5.9 Batch-Rolling und Statistik
// -----------------------------------------------------------------------------
/**
 * SZENARIO: Statistische Analyse durch Batch-Rolling
 * 
 * Nützlich für:
 * - Testen von House Rules
 * - Validierung von Wahrscheinlichkeiten
 * - Simulation von Szenarien
 * - Balancing-Entscheidungen
 */

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  5.9 SZENARIO - Batch-Rolling und Statistik');
console.log('═══════════════════════════════════════════════════════════════\n');

function runBatchAnalysis(dice: GurpsDice, skill: number, iterations: number, label: string) {
  const outcomes = {
    'critical-success': 0,
    'success': 0,
    'failure': 0,
    'critical-failure': 0,
  };
  
  let totalMargin = 0;
  let minRoll = 18;
  let maxRoll = 3;
  
  for (let i = 0; i < iterations; i++) {
    const result = dice.roll({ targetNumber: skill });
    outcomes[result.outcome]++;
    totalMargin += result.margin;
    minRoll = Math.min(minRoll, result.total);
    maxRoll = Math.max(maxRoll, result.total);
  }
  
  console.log(`${label} (${iterations} Würfe, Skill ${skill}):\n`);
  console.log('  Ergebnisverteilung:');
  console.log(`    Kritischer Erfolg:    ${(outcomes['critical-success'] / iterations * 100).toFixed(1)}%`);
  console.log(`    Normaler Erfolg:      ${(outcomes['success'] / iterations * 100).toFixed(1)}%`);
  console.log(`    Normaler Fehlschlag:  ${(outcomes['failure'] / iterations * 100).toFixed(1)}%`);
  console.log(`    Kritischer Fehler:    ${(outcomes['critical-failure'] / iterations * 100).toFixed(1)}%`);
  console.log('');
  console.log(`  Gesamterfolgsrate: ${((outcomes['critical-success'] + outcomes['success']) / iterations * 100).toFixed(1)}%`);
  console.log(`  Durchschnittl. Margin: ${(totalMargin / iterations).toFixed(2)}`);
  console.log(`  Würfelspanne: ${minRoll} - ${maxRoll}`);
  console.log('');
}

runBatchAnalysis(gurpsDice, 12, 100, 'STANDARD MODE');
runBatchAnalysis(cinematicDice, 12, 100, 'CINEMATIC MODE');
runBatchAnalysis(hardcoreDice, 12, 100, 'HARDCORE MODE');

// =============================================================================
// ZUSAMMENFASSUNG
// =============================================================================

console.log('═══════════════════════════════════════════════════════════════');
console.log('  ZUSAMMENFASSUNG - API Übersicht');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`
INSTANZIIERUNG:
  const dice = new GurpsDice();                    // Standard-Regeln
  const dice = new GurpsDice(customConfig);        // Eigene Regeln
  import { gurpsDice } from './gurps-dice';        // Vorkonfigurierte Instanz

WÜRFELN:
  dice.roll({ targetNumber, modifier?, description? })
  → DiceResult

QUICK CONTEST:
  dice.quickContest(attackerInput, defenderInput)
  → { attacker: DiceResult, defender: DiceResult, winner: 'attacker'|'defender'|'tie' }

WAHRSCHEINLICHKEIT:
  dice.getSuccessProbability(targetNumber)
  → number (0.0 - 1.0)

STATISTIK:
  dice.getStats()
  → { min, max, average, median }

KONFIGURATION:
  dice.getConfig()                                 // Aktuelle Regeln abrufen
  dice.updateConfig({ parameter: value })          // Regeln ändern
  dice.resetConfig()                               // Auf Standard zurücksetzen
`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Demo abgeschlossen');
console.log('═══════════════════════════════════════════════════════════════');

}
