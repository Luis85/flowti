/**
 * parallel-group — batches multiple read-only assertions into a single
 * CLI subprocess eval call, reducing N×3 calls to 1.
 *
 * Each sub-action compiles to a JavaScript fragment that:
 *   1. Performs the DOM/eval check
 *   2. Applies pass/fail highlight CSS class
 *   3. Shows a Notice toast
 *   4. Pushes { i, ok, v, err? } to the results array
 *
 * The assembled IIFE returns JSON.stringify(results).
 */
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import type {
	AssertAction,
	AssertTextAction,
	AssertNumberAction,
	AssertValueAction,
	EvalAction,
	ParallelGroupSubAction,
} from "./journeyTypes";

// ─── Result shape returned from batched eval ─────────────────────

export interface ParallelCheckResult {
	/** Zero-based index in the actions array. */
	i: number;
	/** Whether the check passed. */
	ok: boolean;
	/** Diagnostic value (e.g. element count, text content). */
	v: string;
	/** Error message if the check threw. */
	err?: string;
}

// ─── Escape helpers ──────────────────────────────────────────────

function esc(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ─── Highlight + Notice fragments ────────────────────────────────

function highlightFrag(varName: string): string {
	return [
		`if (${varName}) {`,
		`  ${varName}.scrollIntoView({behavior:'smooth',block:'center'});`,
		`  const cls = ok ? 'ft-e2e-highlight-assert-pass' : 'ft-e2e-highlight-assert-fail';`,
		`  ${varName}.classList.add(cls);`,
		`  setTimeout(() => ${varName}.classList.remove(cls), 800);`,
		`}`,
	].join(" ");
}

function noticeFrag(label: string): string {
	const escaped = esc(label);
	return `new Notice((ok ? '\\u2713' : '\\u2717') + ' ${escaped}', ok ? 2000 : 4000);`;
}

// ─── Per-type compilers ──────────────────────────────────────────

function compileAssertVisible(action: AssertAction, i: number): string {
	const sel = esc(action.selector!);
	const label = action.description || `visible: ${action.selector}`;
	return [
		`try {`,
		`  const els = document.querySelectorAll('${sel}');`,
		`  const ok = els.length > 0;`,
		`  const el = els[0];`,
		highlightFrag("el"),
		noticeFrag(label),
		`  R.push({i:${i},ok,v:String(els.length)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertNotVisible(action: AssertAction, i: number): string {
	const sel = esc(action.selector!);
	const label = action.description || `not-visible: ${action.selector}`;
	return [
		`try {`,
		`  const els = document.querySelectorAll('${sel}');`,
		`  const ok = els.length === 0;`,
		noticeFrag(label),
		`  R.push({i:${i},ok,v:String(els.length)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertTextSubtype(action: AssertAction, i: number): string {
	const sel = esc(action.selector!);
	const expected = esc(action.contains!);
	const label = action.description || `text: "${action.contains}"`;
	return [
		`try {`,
		`  const els = document.querySelectorAll('${sel}');`,
		`  const text = els[0]?.textContent ?? '';`,
		`  const ok = text.includes('${expected}');`,
		`  const el = els[0];`,
		highlightFrag("el"),
		noticeFrag(label),
		`  R.push({i:${i},ok,v:text.slice(0,200)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertCount(action: AssertAction, i: number): string {
	const sel = esc(action.selector!);
	const expected = action.count!;
	const label = action.description || `count: ${expected} of ${action.selector}`;
	return [
		`try {`,
		`  const els = document.querySelectorAll('${sel}');`,
		`  const ok = els.length === ${expected};`,
		noticeFrag(label),
		`  R.push({i:${i},ok,v:String(els.length)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertLeaf(action: AssertAction, i: number): string {
	const viewType = esc(action.viewType!);
	const label = action.description || `leaf: ${action.viewType}`;
	return [
		`try {`,
		`  const els = document.querySelectorAll(".workspace-leaf-content[data-type='${viewType}']");`,
		`  const ok = els.length > 0;`,
		noticeFrag(label),
		`  R.push({i:${i},ok,v:String(els.length)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertAttr(action: AssertAction, i: number): string {
	const sel = esc(action.selector!);
	const attrName = esc(action.attr!);
	const expectedValue = esc(action.value!);
	const label = action.description || `attr ${action.attr}="${action.value}"`;
	return [
		`try {`,
		`  const els = document.querySelectorAll('${sel}');`,
		`  const attrVal = els[0]?.getAttribute('${attrName}') ?? '';`,
		`  const ok = attrVal === '${expectedValue}';`,
		`  const el = els[0];`,
		highlightFrag("el"),
		noticeFrag(label),
		`  R.push({i:${i},ok,v:attrVal});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertEvalSubtype(action: AssertAction, i: number): string {
	const code = action.code!;
	const expected = esc(action.expected!);
	const label = action.description || `eval: expected "${action.expected}"`;
	return [
		`try {`,
		`  const result = String(${code});`,
		`  const ok = result === '${expected}';`,
		noticeFrag(label),
		`  R.push({i:${i},ok,v:result.slice(0,200)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertTextTool(action: AssertTextAction, i: number): string {
	const sel = esc(action.selector);
	const expected = esc(action.contains);
	const label = action.description || `text: "${action.contains}"`;
	return [
		`try {`,
		`  const els = document.querySelectorAll('${sel}');`,
		`  const text = els[0]?.textContent ?? '';`,
		`  const ok = text.includes('${expected}');`,
		`  const el = els[0];`,
		highlightFrag("el"),
		noticeFrag(label),
		`  R.push({i:${i},ok,v:text.slice(0,200)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertNumberTool(action: AssertNumberAction, i: number): string {
	const sel = esc(action.selector);
	const op = action.operator;
	const val = action.value;
	const label = action.description || `number: ${op} ${val}`;
	const opMap: Record<string, string> = { eq: "===", gt: ">", gte: ">=", lt: "<", lte: "<=" };
	const opExpr = opMap[op] ?? "===";
	return [
		`try {`,
		`  const els = document.querySelectorAll('${sel}');`,
		`  const text = els[0]?.textContent ?? '';`,
		`  const num = parseFloat(text.replace(/[^0-9.\\-]/g, ''));`,
		`  const ok = !isNaN(num) && num ${opExpr} ${val};`,
		`  const el = els[0];`,
		highlightFrag("el"),
		noticeFrag(label),
		`  R.push({i:${i},ok,v:String(num)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileAssertValueTool(action: AssertValueAction, i: number): string {
	const sel = esc(action.selector);
	const label = action.description || `value: ${action.selector}`;
	let checkExpr: string;
	if (action.equals !== undefined) {
		checkExpr = `val === '${esc(action.equals)}'`;
	} else {
		checkExpr = `val.includes('${esc(action.contains!)}')`;
	}
	return [
		`try {`,
		`  const el = document.querySelector('${sel}');`,
		`  const val = el ? el.value : null;`,
		`  if (val === null) { R.push({i:${i},ok:false,v:'null',err:'Element not found or no value'}); }`,
		`  else {`,
		`    const ok = ${checkExpr};`,
		highlightFrag("el"),
		noticeFrag(label),
		`    R.push({i:${i},ok,v:val.slice(0,200)});`,
		`  }`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

function compileEvalTool(action: EvalAction, i: number): string {
	const code = action.code;
	const label = action.description || "eval";
	let checkExpr: string;
	if (action.expect) {
		if (action.expect.type === "equals") {
			checkExpr = `result === '${esc(action.expect.value)}'`;
		} else if (action.expect.type === "truthy") {
			checkExpr = `!!result && result !== 'false' && result !== 'undefined' && result !== 'null'`;
		} else {
			// json match
			const checks = Object.entries(action.expect.match)
				.map(([k, v]) => `parsed['${esc(k)}'] === ${typeof v === "string" ? `'${esc(v)}'` : String(v)}`)
				.join(" && ");
			checkExpr = `(() => { try { const parsed = JSON.parse(result); return ${checks}; } catch { return false; } })()`;
		}
	} else {
		checkExpr = "true";
	}
	return [
		`try {`,
		`  const result = String(${code});`,
		`  const ok = ${checkExpr};`,
		noticeFrag(label),
		`  R.push({i:${i},ok,v:result.slice(0,200)});`,
		`} catch(e) { R.push({i:${i},ok:false,v:'',err:e.message}); }`,
	].join(" ");
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Compiles a single sub-action into a JavaScript code fragment.
 * Pure function — the core testable unit.
 */
export function compileCheck(action: ParallelGroupSubAction, index: number): string {
	if (action.tool === "assert") {
		switch (action.type) {
			case "visible": return compileAssertVisible(action, index);
			case "not-visible": return compileAssertNotVisible(action, index);
			case "text": return compileAssertTextSubtype(action, index);
			case "count": return compileAssertCount(action, index);
			case "leaf": return compileAssertLeaf(action, index);
			case "attr": return compileAssertAttr(action, index);
			case "eval": return compileAssertEvalSubtype(action, index);
			default:
				throw new Error(`parallel-group: unsupported assert type '${action.type}'`);
		}
	}
	if (action.tool === "assert-text") return compileAssertTextTool(action, index);
	if (action.tool === "assert-number") return compileAssertNumberTool(action, index);
	if (action.tool === "assert-value") return compileAssertValueTool(action, index);
	if (action.tool === "eval") return compileEvalTool(action, index);
	throw new Error(`parallel-group: unsupported tool '${(action as { tool: string }).tool}'`);
}

/**
 * Assembles the complete IIFE eval string from compiled fragments.
 */
export function buildBatchEval(actions: ParallelGroupSubAction[]): string {
	const fragments = actions.map((action, i) => compileCheck(action, i));
	return `(() => { const R = []; ${fragments.join(" ")} return JSON.stringify(R); })()`;
}

/**
 * Parses the JSON result string from a batched eval.
 */
export function parseResults(json: string): ParallelCheckResult[] {
	return JSON.parse(json) as ParallelCheckResult[];
}

/** Generates a fallback description from an action's fields. */
function describeAction(action: ParallelGroupSubAction): string {
	if (action.tool === "assert") {
		if (action.type === "visible") return `Expected '${action.selector}' to be visible`;
		if (action.type === "not-visible") return `Expected '${action.selector}' to NOT be visible`;
		if (action.type === "text") return `Expected '${action.selector}' to contain '${action.contains}'`;
		if (action.type === "count") return `Expected ${action.count} of '${action.selector}'`;
		if (action.type === "leaf") return `Expected leaf '${action.viewType}'`;
		if (action.type === "attr") return `Expected attr '${action.attr}' = '${action.value}' on '${action.selector}'`;
		if (action.type === "eval") return `Expected eval = '${action.expected}'`;
	}
	if (action.tool === "assert-text") return `Expected '${action.selector}' text contains '${action.contains}'`;
	if (action.tool === "assert-number") return `Expected '${action.selector}' ${action.operator} ${action.value}`;
	if (action.tool === "assert-value") return `Expected '${action.selector}' value`;
	if (action.tool === "eval") return "eval assertion";
	return `${action.tool} check`;
}

/**
 * Formats a multi-failure error message. Returns null if all passed.
 */
export function formatFailures(
	results: ParallelCheckResult[],
	actions: ParallelGroupSubAction[],
): string | null {
	const failures = results.filter((r) => !r.ok);
	if (failures.length === 0) return null;

	const total = results.length;
	const lines = failures.map((f) => {
		const action = actions[f.i];
		const desc = action.description || describeAction(action);
		const detail = f.err ?? f.v;
		return `  [${f.i}] ${desc} (got: ${detail})`;
	});

	return `parallel-group: ${failures.length} of ${total} checks failed:\n${lines.join("\n")}`;
}

/**
 * Validates that a parallel-group contains only allowed sub-actions.
 */
export function validateParallelGroup(actions: ParallelGroupSubAction[]): void {
	for (let i = 0; i < actions.length; i++) {
		const action = actions[i];
		if ((action as { tool: string }).tool === "parallel-group") {
			throw new Error(`parallel-group: nesting not allowed (action ${i})`);
		}
		if (action.tool === "assert" && action.type === "event") {
			throw new Error(
				`parallel-group: assert type 'event' not supported (action ${i}). Use sequential assert for event assertions.`,
			);
		}
		if (action.tool === "eval" && (action as EvalAction).store) {
			throw new Error(
				`parallel-group: eval with 'store' not allowed (action ${i}). Use sequential eval to store variables.`,
			);
		}
	}
}

/** Deep-resolves {{variable}} references in all string fields of a sub-action. */
function resolveSubAction(
	action: ParallelGroupSubAction,
	variables: Record<string, string>,
	resolveFn: (template: string, vars: Record<string, string>) => string,
): ParallelGroupSubAction {
	const clone = JSON.parse(JSON.stringify(action)) as Record<string, unknown>;
	for (const [key, value] of Object.entries(clone)) {
		if (typeof value === "string") {
			clone[key] = resolveFn(value, variables);
		}
	}
	return clone as unknown as ParallelGroupSubAction;
}

/**
 * Executes a parallel-group action: validates, resolves variables,
 * compiles to batched eval, runs single subprocess call, parses results,
 * and throws with all failures if any check failed.
 */
export function executeParallelGroup(
	cli: ObsidianCli,
	actions: ParallelGroupSubAction[],
	variables: Record<string, string>,
	resolveFn: (template: string, vars: Record<string, string>) => string,
): void {
	validateParallelGroup(actions);

	const resolved = actions.map((action) => resolveSubAction(action, variables, resolveFn));
	const evalCode = buildBatchEval(resolved);
	const result = cli.eval(evalCode);

	if (!result.success) {
		throw new Error(`parallel-group eval failed: ${result.error}`);
	}

	const results = parseResults(result.value);
	const errorMsg = formatFailures(results, resolved);
	if (errorMsg) {
		throw new Error(errorMsg);
	}
}
