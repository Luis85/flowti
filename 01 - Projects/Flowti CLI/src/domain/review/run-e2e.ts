/**
 * run-e2e.ts — Thin entry point for E2E test execution.
 *
 * Delegates to the E2E domain service. Kept in review/ for backward
 * compatibility with existing npm scripts that reference this path.
 *
 * Usage:
 *   node scripts/run-e2e.mjs                                           Full suite
 *   node scripts/run-e2e.mjs --journey=installer                       Installer only
 *   node scripts/run-e2e.mjs --journey=getting-started                  One journey
 *   node scripts/run-e2e.mjs --journey=getting-started,component-library Multiple journeys
 *   node scripts/run-e2e.mjs --list                                     Interactive test session
 */

import { proc } from "../../infrastructure/proc.js";
import { startInteractiveSession, runE2ESuite } from "../e2e/E2EService.js";

const isListMode: boolean = proc.argv().includes("--list");

if (isListMode) {
	await startInteractiveSession();
} else {
	const journeyArg = proc.argv().find((a) => a.startsWith("--journey="));
	const journeyFilter = journeyArg ? journeyArg.split("=")[1] : undefined;
	runE2ESuite(journeyFilter);
}
