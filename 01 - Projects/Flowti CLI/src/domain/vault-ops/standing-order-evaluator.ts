/**
 * standing-order-evaluator.ts — Evaluates standing order rules against vault events.
 *
 * Given a vault event (e.g. file created in a watched folder), matches it against
 * standing orders from the task system, evaluates rules against file frontmatter,
 * and produces vault operation requests for any matched rules.
 */

import { parseFrontmatter } from "./frontmatter.js";
import { buildIndex, matchEvent } from "../tasks/standing-order-index.js";
import type { VaultOpsDeps, VaultEvent, AnyVaultOpRequest, VaultTagRequest } from "./vault-ops-types.js";
import type { StandingOrderRule, StandingOrderPayload } from "../tasks/task-types.js";

// ── Internal helpers ─────────────────────────────────────────────────

interface IndexableTask {
	readonly id: string;
	readonly type: string;
	readonly status: string;
	readonly assignee?: string;
	readonly standingOrder?: StandingOrderPayload;
}

function matchesTagsMissing(fileTags: readonly string[], required: readonly string[]): boolean {
	return required.some((tag) => !fileTags.includes(tag));
}

function extractTags(frontmatter: Record<string, unknown>): readonly string[] {
	const raw = frontmatter["tags"];
	if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
	return [];
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Evaluate standing order rules against a file's frontmatter.
 * Returns the first matching rule's action/value pair, or null if no match.
 */
export function evaluateRules(
	rules: readonly StandingOrderRule[],
	filePath: string,
	deps: VaultOpsDeps,
): { action: string; value: string } | null {
	let content: string;
	try {
		const fullPath = deps.paths.join(deps.vaultRoot, filePath);
		content = deps.disk.readFileSync(fullPath, "utf-8");
	} catch {
		return null;
	}

	const { frontmatter } = parseFrontmatter(content);
	const fileTags = extractTags(frontmatter);

	for (const rule of rules) {
		const match = rule.match as Record<string, unknown>;
		const tags = match["tags"] as Record<string, unknown> | undefined;
		if (!tags) continue;

		const missing = tags["missing"];
		if (!Array.isArray(missing)) continue;

		const requiredTags = missing.filter((t): t is string => typeof t === "string");
		if (matchesTagsMissing(fileTags, requiredTags)) {
			return { action: rule.action, value: rule.value };
		}
	}

	return null;
}

/**
 * Evaluate a vault event against all standing orders and return vault op requests.
 */
export function evaluateEvent(
	event: VaultEvent,
	tasks: readonly IndexableTask[],
	deps: VaultOpsDeps,
): AnyVaultOpRequest[] {
	const index = buildIndex(tasks as IndexableTask[]);
	const matched = matchEvent(index, { folder: event.folder, type: event.type });
	const requests: AnyVaultOpRequest[] = [];

	for (const order of matched) {
		let payload: StandingOrderPayload;
		try {
			const payloadPath = deps.paths.join(deps.vaultRoot, "docs/tasks", `${order.taskId}.json`);
			const raw = deps.disk.readFileSync(payloadPath, "utf-8");
			payload = JSON.parse(raw) as StandingOrderPayload;
		} catch {
			continue;
		}

		const result = evaluateRules(payload.rules, event.path, deps);
		if (result && result.action === "tag") {
			const tagRequest: VaultTagRequest = {
				operation: "vault-tag",
				agentName: order.assignee,
				taskId: order.taskId,
				path: event.path,
				addTags: [result.value],
			};
			requests.push(tagRequest);
		}
	}

	return requests;
}

/**
 * Record a standing order execution. Pure function — returns updated payload.
 */
export function recordStandingOrderRun(
	payload: StandingOrderPayload,
	timestamp: string,
): StandingOrderPayload {
	return {
		...payload,
		runCount: payload.runCount + 1,
		lastRun: timestamp,
	};
}
