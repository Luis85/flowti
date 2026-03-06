/**
 * Domain types for Test Management.
 *
 * Defines the registry, run summary, pyramid, coverage, and compliance
 * types consumed by the Test Management Hub and its calculation modules.
 */

// ── Union Types ──────────────────────────────────────────────

/** Journey type classification. */
export type JourneyType = "functional" | "regression" | "smoke" | "exploratory" | "blueprint";

/** Run status derived from latest result. */
export type JourneyStatus = "passing" | "failing" | "never-run" | "stale";

/** Pyramid trend direction. */
export type TrendDirection = "up" | "down" | "stable";

/** Coverage status for a PRD. */
export type CoverageStatus = "covered" | "partial" | "uncovered";

/** Supported ISO standards. */
export type IsoStandard = "iso-9001" | "iso-27001" | "iso-25010";

// ── Journey Registry ─────────────────────────────────────────

/** Registry entry for a discovered journey. */
export interface JourneyRegistryEntry {
	name: string;
	chapter?: number;
	type: JourneyType;
	category?: string;
	domain?: string;
	prd?: string;
	feature?: string;
	actors: string[];
	services: string[];
	stepCount: number;
	tools: string[];
	jsonPath: string;
	canvasPath?: string;
	testSourcePath?: string;
	complianceTags: string[];
	lastRunResult?: JourneyRunSummary;
	runHistory: JourneyRunSummary[];
}

/** Summary of a single journey run. */
export interface JourneyRunSummary {
	date: string;
	totalSteps: number;
	passed: number;
	failed: number;
	skipped: number;
	durationMs: number;
}

// ── Test Pyramid ─────────────────────────────────────────────

/** Test pyramid layer. */
export interface PyramidLayer {
	count: number;
	passRate: number;
	trend: TrendDirection;
}

/** Full test pyramid state. */
export interface TestPyramidState {
	e2e: PyramidLayer;
	flow: PyramidLayer;
	unit: PyramidLayer;
}

// ── Coverage ─────────────────────────────────────────────────

/** PRD coverage entry. */
export interface CoverageEntry {
	prdName: string;
	prdStage: string;
	domain: string;
	journeyCount: number;
	journeyNames: string[];
	status: CoverageStatus;
}

// ── Compliance ───────────────────────────────────────────────

/** ISO compliance characteristic definition. */
export interface ComplianceCharacteristic {
	id: string;
	standard: IsoStandard;
	name: string;
	description: string;
	guidance: string;
}

/** Compliance score per standard. */
export interface ComplianceScore {
	standard: string;
	total: number;
	covered: number;
	percentage: number;
	gaps: string[];
}

// ── Service State ────────────────────────────────────────────

/** Persisted state for TestManagementService. */
export interface TestManagementState {
	journeys: JourneyRegistryEntry[];
	complianceTags: Record<string, string[]>;
	pyramidBaseline?: TestPyramidState;
	lastScanDate?: string;
}

export function createDefaultState(): TestManagementState {
	return { journeys: [], complianceTags: {} };
}
