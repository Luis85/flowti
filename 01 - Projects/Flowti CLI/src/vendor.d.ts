declare module "@pythonidaer/complexity-report/integration/eslint/index.js" {
	export function findESLintConfig(projectRoot: string): string | null;
	export function getComplexityVariant(configPath: string): "classic" | "modified";
	export function runESLintComplexityCheck(root: string): Promise<import("eslint").ESLint.LintResult[]>;
}

declare module "@pythonidaer/complexity-report/function-extraction/index.js" {
	export function extractFunctionsFromESLintResults(results: import("eslint").ESLint.LintResult[], projectRoot: string): Array<{ file: string; [key: string]: unknown }>;
}

declare module "@pythonidaer/complexity-report/function-boundaries/index.js" {
	export function findFunctionBoundaries(sourceCode: string, functions: Array<{ file: string; [key: string]: unknown }>): unknown;
}

declare module "@pythonidaer/complexity-report/decision-points/index.js" {
	export function parseDecisionPointsAST(
		sourceCode: string,
		functionBoundaries: unknown,
		functions: Array<{ file: string; [key: string]: unknown }>,
		filePath: string,
		projectRoot: string,
		options: { variant: string },
	): Promise<Array<{ line: number; type: string; functionLine: number }>>;
}
