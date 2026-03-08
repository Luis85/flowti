/**
 * e2e-types.ts — Shared type definitions for the E2E domain.
 */

export interface PrerequisiteResults {
	vaultExists: boolean;
	artifactsPresent: boolean;
	missingArtifacts: string[];
	cliResponsive: boolean;
	vaultInstalled: boolean;
	testDataPresent: boolean;
}

export interface JourneyEntry {
	slug: string;
	name: string;
	chapter: string;
	steps: number;
	description: string;
}

export interface SessionConfig {
	sessionName: string;
	selectedSlugs: string[];
	includeInstaller: boolean;
	includePrerequisites: boolean;
	stepFilter: Record<string, "all" | string[]>;
}

export interface TestStats {
	totalTests: number;
	passed: number;
	failed: number;
	skipped: number;
}

export interface ReportSource {
	file: string;
	fm: Record<string, unknown> | null;
}

export interface BuildStats {
	build: Record<string, unknown> | null;
	test: Record<string, unknown> | null;
	coverage: Record<string, unknown> | null;
	performance: Record<string, unknown> | null;
	cycle: Record<string, unknown> | null;
	e2e: Record<string, unknown> | null;
	traceability: Record<string, unknown> | null;
	unitTests: TestStats;
}

export interface ExtractedMetrics {
	b: Record<string, unknown>;
	t: Record<string, unknown>;
	c: Record<string, unknown>;
	e: Record<string, unknown>;
	p: Record<string, unknown>;
	cy: Record<string, unknown>;
	sizeKb: number;
	linesPct: number;
	branchesPct: number;
	functionsPct: number;
	cycle: string | number;
}

export interface ViewResult {
	action: "main" | "quit";
	exitCode: number;
}

export interface InteractiveState {
	lastExitCode: number;
	incrementPassed: boolean;
}

export interface AuditFrontmatters {
	buildFm: Record<string, unknown>;
	testFm: Record<string, unknown>;
	e2eFm: Record<string, unknown>;
	perfFm: Record<string, unknown>;
	cycleFm: Record<string, unknown>;
}
