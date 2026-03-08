/**
 * e2e/ barrel — re-exports all E2E report modules.
 */

export * from "./e2e-report-types.js";
export * from "./e2e-report-utils.js";
export { readVitestResults, readJourneyResults, reconcileResults, parseVitestCase, parseVitestSuite, buildJourneyStepMap, findMatchingJourney, reconcileCase } from "./e2e-report-vitest.js";
export { generateJourneyReport, extractJourneyFields, buildErrorContextLines } from "./e2e-report-journey.js";
export { generateJourneyCanvas, formatActionText } from "./e2e-report-canvas.js";
export { readLatestEventTrace, readStartupPerf, buildPerfLines, buildEventTraceLines, buildPerfEventStats, classifyPerfEvent, parsePerfPayload } from "./e2e-report-perf.js";
export { generateE2EReport, writeJourneyOutputs, aggregateJourneyStats, computeReconciledTotals, cleanupResults } from "./e2e-report-summary.js";
