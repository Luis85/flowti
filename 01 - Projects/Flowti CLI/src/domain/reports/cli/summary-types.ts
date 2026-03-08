/**
 * summary-types.ts — Shared type definitions for the summary report pipeline.
 */

export interface ParsedFrontmatter {
	[key: string]: string;
}

export interface ReportSnapshot {
	label: string;
	file: string;
	frontmatter: ParsedFrontmatter;
}

export interface Finding {
	category: "improvement" | "risk" | "positive";
	message: string;
	details?: string[];
}

export interface TestJsonData {
	numTotalTestSuites: number;
	numPassedTestSuites: number;
	numFailedTestSuites: number;
	numTotalTests: number;
	numPassedTests: number;
	numFailedTests: number;
	numPendingTests: number;
	success: boolean;
}

export interface CoverageJsonSummary {
	linesPct: number;
	branchesPct: number;
	functionsPct: number;
	statementsPct: number;
	filesCovered: number;
}

export interface JsonDataSources {
	tests?: TestJsonData;
	coverage?: CoverageJsonSummary;
}

export interface FileCoverageStats {
	file: string;
	loc: number;
	stmtTotal: number;
	stmtCovered: number;
	stmtPct: number;
	fnTotal: number;
	fnUncovered: number;
}

export interface AnalysisFileEntry {
	file: string;
	decisionPointCount: number;
}

export interface ComplexityFunctionEntry {
	file: string;
	functionName: string;
	line: number;
	complexity: number;
}

export interface ComplexityFunctionsSummary {
	totalFunctions: number;
	maxComplexity: number;
	avgComplexity: number;
	medianComplexity: number;
	totalComplexity: number;
	aboveThreshold10: number;
	aboveThreshold15: number;
}

export interface ComplexityFunctionsData {
	summary: ComplexityFunctionsSummary;
	functions: ComplexityFunctionEntry[];
}

export interface DetailedSources {
	perFile: FileCoverageStats[];
	topComplexFiles: AnalysisFileEntry[];
	complexityFunctions?: ComplexityFunctionsData;
}

export interface LintIssue {
	file: string;
	line: number;
	col: number;
	severity: "warning" | "error";
	message: string;
	rule: string;
}

export interface LintRuleSummary {
	rule: string;
	count: number;
}

export interface LintResult {
	warnings: number;
	errors: number;
	breakdown: LintRuleSummary[];
	issues: LintIssue[];
}

export interface IstanbulFileCoverage {
	s: Record<string, number>;
	b: Record<string, number[]>;
	f: Record<string, number>;
	statementMap: Record<string, unknown>;
	branchMap: Record<string, unknown>;
	fnMap: Record<string, unknown>;
}

export interface TypeDocIssue {
	severity: "warning" | "error";
	message: string;
}

export interface TypeDocResult {
	warnings: number;
	errors: number;
	issues: TypeDocIssue[];
}

export interface ReportDef {
	subdir: string;
	label: string;
	stableName?: string;
}

export interface DomainMetrics {
	domain: string;
	files: number;
	loc: number;
	statements: number;
	covered: number;
	coveragePct: number;
	functions: number;
	uncoveredFns: number;
	decisionPoints: number;
}
