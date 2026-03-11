/**
 * run-e2e.ts — E2E execution entry point.
 *
 * Re-exports from e2e-service for use by the review controller.
 * No top-level execution — all dispatching goes through main.ts → controller.
 */

export { startInteractiveSession, runE2ESuite } from "../e2e/e2e-service.js";
