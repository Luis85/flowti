/**
 * complexity-analyzer.ts — Single-pass TypeScript AST complexity analyzer.
 *
 * Replaces the @pythonidaer/complexity-report + ESLint pipeline with a
 * direct TypeScript compiler API walk. Parses each file once and extracts:
 *   - Per-function cyclomatic complexity
 *   - Decision point locations (if/for/while/switch/ternary)
 *   - Function metadata (name, file, line, start/end)
 *
 * Runs ~10x faster than ESLint-based analysis because:
 *   - No ESLint config resolution, rule engine, or warning serialization
 *   - Single AST parse per file (vs 3 passes with the library)
 *   - Uses TypeScript's own parser which is optimized for batch processing
 */

import ts from "typescript";
import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";

// ── Output types ────────────────────────────────────────────────────

export interface ComplexityFunction {
	file: string;
	functionName: string;
	line: number;
	complexity: number;
}

export interface DecisionPoint {
	line: number;
	type: string;
	functionLine: number;
}

export interface FileAnalysis {
	file: string;
	functions: ComplexityFunction[];
	decisionPointCount: number;
	decisionPoints: DecisionPoint[];
	decisionPointLines: number[];
	decisionPointLineRanges: string[];
}

export interface ComplexitySummary {
	totalFunctions: number;
	maxComplexity: number;
	avgComplexity: number;
	medianComplexity: number;
	totalComplexity: number;
	aboveThreshold10: number;
	aboveThreshold15: number;
}

export interface AnalysisResult {
	summary: ComplexitySummary;
	functions: ComplexityFunction[];
	files: FileAnalysis[];
}

// ── Decision point classification ───────────────────────────────────

const DECISION_POINT_KINDS = new Map<ts.SyntaxKind, string>([
	[ts.SyntaxKind.IfStatement, "IfStatement"],
	[ts.SyntaxKind.ForStatement, "ForStatement"],
	[ts.SyntaxKind.ForInStatement, "ForInStatement"],
	[ts.SyntaxKind.ForOfStatement, "ForOfStatement"],
	[ts.SyntaxKind.WhileStatement, "WhileStatement"],
	[ts.SyntaxKind.DoStatement, "DoWhileStatement"],
	[ts.SyntaxKind.CaseClause, "SwitchCase"],
	[ts.SyntaxKind.CatchClause, "CatchClause"],
	[ts.SyntaxKind.ConditionalExpression, "ConditionalExpression"],
]);

/** Logical operators that add a branch (&&, ||, ??). */
function isLogicalBranch(node: ts.Node): boolean {
	if (!ts.isBinaryExpression(node)) return false;
	const op = node.operatorToken.kind;
	return (
		op === ts.SyntaxKind.AmpersandAmpersandToken ||
		op === ts.SyntaxKind.BarBarToken ||
		op === ts.SyntaxKind.QuestionQuestionToken
	);
}

// ── Function name extraction ────────────────────────────────────────

function getFunctionName(node: ts.Node): string {
	// Named function/method
	if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
		return node.name?.getText() ?? "(anonymous)";
	}
	// Constructor
	if (ts.isConstructorDeclaration(node)) {
		const parent = node.parent;
		if (ts.isClassDeclaration(parent) && parent.name) {
			return `${parent.name.getText()}.constructor`;
		}
		return "constructor";
	}
	// Getter/setter
	if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
		const prefix = ts.isGetAccessorDeclaration(node) ? "get " : "set ";
		return `${prefix}${node.name.getText()}`;
	}
	// Arrow function or function expression assigned to a variable
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		// Check parent: const foo = () => ...
		const parent = node.parent;
		if (ts.isVariableDeclaration(parent) && parent.name) {
			return parent.name.getText();
		}
		// Property assignment: { foo: () => ... }
		if (ts.isPropertyAssignment(parent) && parent.name) {
			return parent.name.getText();
		}
		// Property declaration: class { foo = () => ... }
		if (ts.isPropertyDeclaration(parent) && parent.name) {
			return parent.name.getText();
		}
		// Named function expression: const x = function foo() {}
		if (ts.isFunctionExpression(node) && node.name) {
			return node.name.getText();
		}
		return "(anonymous)";
	}
	return "(anonymous)";
}

// ── Function detection ──────────────────────────────────────────────

function isFunctionNode(node: ts.Node): boolean {
	return (
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isConstructorDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node)
	);
}

// ── Single-file analysis ────────────────────────────────────────────

interface FunctionContext {
	name: string;
	line: number;
	complexity: number;
	decisionPoints: DecisionPoint[];
}

function analyzeSourceFile(sourceFile: ts.SourceFile, relPath: string): FileAnalysis {
	const functionStack: FunctionContext[] = [];
	const allFunctions: ComplexityFunction[] = [];
	const allDecisionPoints: DecisionPoint[] = [];

	function currentFunction(): FunctionContext | undefined {
		return functionStack.length > 0 ? functionStack[functionStack.length - 1] : undefined;
	}

	function addComplexity(node: ts.Node, type: string): void {
		const ctx = currentFunction();
		if (!ctx) return;
		ctx.complexity++;
		const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
		const dp: DecisionPoint = { line, type, functionLine: ctx.line };
		ctx.decisionPoints.push(dp);
		allDecisionPoints.push(dp);
	}

	function visit(node: ts.Node): void {
		if (isFunctionNode(node)) {
			const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
			const ctx: FunctionContext = {
				name: getFunctionName(node),
				line,
				complexity: 1, // Base complexity
				decisionPoints: [],
			};
			functionStack.push(ctx);
			ts.forEachChild(node, visit);
			functionStack.pop();

			allFunctions.push({
				file: relPath,
				functionName: ctx.name,
				line: ctx.line,
				complexity: ctx.complexity,
			});
			return;
		}

		// Decision points that add complexity
		const dpType = DECISION_POINT_KINDS.get(node.kind);
		if (dpType) {
			addComplexity(node, dpType);
		} else if (isLogicalBranch(node)) {
			addComplexity(node, "LogicalExpression");
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(sourceFile, visit);

	const dpLines = [...new Set(allDecisionPoints.map((dp) => dp.line))].sort((a, b) => a - b);

	return {
		file: relPath,
		functions: allFunctions,
		decisionPointCount: allDecisionPoints.length,
		decisionPoints: allDecisionPoints,
		decisionPointLines: dpLines,
		decisionPointLineRanges: toRanges(dpLines),
	};
}

// ── Range consolidation ─────────────────────────────────────────────

export function toRanges(lines: number[]): string[] {
	if (lines.length === 0) return [];
	const ranges: string[] = [];
	let start = lines[0], end = lines[0];
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === end + 1) {
			end = lines[i];
		} else {
			ranges.push(start === end ? `${start}` : `${start}-${end}`);
			start = lines[i];
			end = lines[i];
		}
	}
	ranges.push(start === end ? `${start}` : `${start}-${end}`);
	return ranges;
}

// ── Summary computation ─────────────────────────────────────────────

function computeSummary(functions: ComplexityFunction[]): ComplexitySummary {
	if (functions.length === 0) {
		return { totalFunctions: 0, maxComplexity: 0, avgComplexity: 0, medianComplexity: 0, totalComplexity: 0, aboveThreshold10: 0, aboveThreshold15: 0 };
	}

	const complexities = functions.map((f) => f.complexity);
	const totalComplexity = complexities.reduce((sum, c) => sum + c, 0);
	const sorted = [...complexities].sort((a, b) => a - b);

	return {
		totalFunctions: functions.length,
		maxComplexity: sorted[sorted.length - 1],
		avgComplexity: Math.round((totalComplexity / functions.length) * 10) / 10,
		medianComplexity: sorted[Math.floor(sorted.length / 2)],
		totalComplexity,
		aboveThreshold10: complexities.filter((c) => c > 10).length,
		aboveThreshold15: complexities.filter((c) => c > 15).length,
	};
}

// ── File collection ─────────────────────────────────────────────────

/** Collect all source .ts files under a directory (excludes tests, .d.ts, stories). */
export function collectSourceFiles(srcDir: string): string[] {
	const files: string[] = [];

	function walk(dir: string): void {
		const entries = disk.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = paths.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name === "__tests__") continue;
				walk(fullPath);
			} else if (
				entry.isFile() &&
				entry.name.endsWith(".ts") &&
				!entry.name.endsWith(".d.ts") &&
				!entry.name.endsWith(".test.ts") &&
				!entry.name.endsWith(".spec.ts") &&
				!entry.name.endsWith(".stories.ts")
			) {
				files.push(fullPath);
			}
		}
	}

	walk(srcDir);
	return files.sort();
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Analyze all TypeScript source files under `srcDir`.
 * Returns per-function complexity, decision points, and summary statistics.
 */
export function analyzeComplexity(srcDir: string, projectRoot: string): AnalysisResult {
	const files = collectSourceFiles(srcDir);
	const fileAnalyses: FileAnalysis[] = [];
	const allFunctions: ComplexityFunction[] = [];

	for (const filePath of files) {
		const content = disk.readFileSync(filePath, "utf-8");
		const relPath = paths.relative(projectRoot, filePath).replace(/\\/g, "/");

		const sourceFile = ts.createSourceFile(
			filePath,
			content,
			ts.ScriptTarget.Latest,
			/* setParentNodes */ true,
			ts.ScriptKind.TS,
		);

		const analysis = analyzeSourceFile(sourceFile, relPath);
		fileAnalyses.push(analysis);
		allFunctions.push(...analysis.functions);
	}

	const sortedFunctions = [...allFunctions].sort((a, b) => b.complexity - a.complexity);

	return {
		summary: computeSummary(allFunctions),
		functions: sortedFunctions,
		files: fileAnalyses,
	};
}
