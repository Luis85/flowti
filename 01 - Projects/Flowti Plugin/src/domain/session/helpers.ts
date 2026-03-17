/**
 * Barrel re-export for session helper modules.
 *
 * This file was decomposed from a 982 LOC monolith into 5 focused modules
 * as part of TD-118 (Cycle 48). All existing imports from "./helpers" continue
 * to work unchanged.
 *
 * Modules:
 * - sessionUtils: state machine, cognitive overload, closure, factories, path reconciliation
 * - timeHelpers: timer computation, duration formatting, activity intelligence
 * - summaryGenerator: frontmatter, summary body, merge, full summary generation
 * - noteParser: reverse parsing of session notes, diff computation
 * - templateHelpers: output templates and placeholder resolution
 */

export { isValidTransition, detectCognitiveOverload, DEFAULT_CLOSURE_TEMPLATE, resolveClosureTemplate, getTaskProgress, resolveTypeConfig, isExcluded, createSession, createContextBinding, createGoal, createDecision, updateSessionPathsForFileMove, updateSessionPathsForFolderMove, updateTemplatePathForFileMove, updateTemplatePathForFolderMove } from "./sessionUtils";

export { computeRemainingMs, computeElapsedMs, isTimerExpired, formatDuration, formatDurationHuman, computePauseSegments, computeTotalPauseMs, computeWallClockMs, computeActiveTimeMs, computeTimelineSummary, computeActivityIntelligence } from "./timeHelpers";

export { generateSessionFrontmatter, generateSessionSummaryBody, mergeSessionNotes, generateSessionSummary } from "./summaryGenerator";
export type { SessionFrontmatter } from "./summaryGenerator";

export { parseSectionCheckboxes, parseSectionText, reverseParseSessionNotes, computeReverseSyncDiff } from "./noteParser";
export type { ReverseParsedNotes, ReverseSyncDiff } from "./noteParser";

export { BUILT_IN_OUTPUT_TEMPLATES, resolvePlaceholder, generateSessionOutput } from "./templateHelpers";
