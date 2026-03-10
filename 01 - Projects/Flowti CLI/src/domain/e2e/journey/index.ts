/**
 * journey/index.ts — Barrel export for the journey sub-domain.
 */

export type {
	JourneyDefinition,
	JourneyStep,
	JourneyAction,
	AcceptanceCriterion,
	JourneyLifecycle,
	JourneyResult,
	StepResult,
	ActionResult,
	JourneyExecutorOptions,
	BaseToolName,
	CliToolName,
	JourneyToolName,
	ProjectTarget,
	JourneyRequirements,
} from "./journey-types.js";

export { executeJourney, resolveEnvironment } from "./journey-executor.js";
export type { ToolDeps, ResolvedEnvironment } from "./journey-executor.js";

export { BASE_TOOLS } from "./journey-tools.js";
export type { ToolExecutor } from "./journey-tools.js";

export {
	createEnvironmentRegistry,
} from "./journey-environment.js";
export type {
	Capability,
	EnvironmentProvider,
	EnvironmentRegistry,
	CapabilityCheckResult,
} from "./journey-environment.js";

export {
	parseJourneyDefinition,
	validateJourney,
	validateRaw,
	loadJourneyFile,
} from "./journey-loader.js";
export type { ValidationResult, ValidationError } from "./journey-loader.js";

export {
	loadJourney,
	loadJourneyFromPath,
	runStep,
	runJourney,
	setToolDeps,
	resetToolDeps,
	ensureTestVault,
	resolveJourneyEnvironment,
} from "./journey-test-runner.js";

export { createDefaultRegistry } from "./providers/index.js";
