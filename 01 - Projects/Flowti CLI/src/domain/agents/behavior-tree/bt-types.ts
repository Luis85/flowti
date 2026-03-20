/**
 * bt-types.ts — Type definitions for the behavior tree agent system.
 *
 * Domain-layer pure. No I/O, no infrastructure imports.
 * AgentNeeds / BTSensorEvent are defined here (not yet in CLI codebase).
 * See spec: docs/specs/2026-03-20-agent-behavior-trees-and-tools-design.md
 */

import type { AgentAttributes, AgentGoal } from "../agent-types.js";
import type { IWorldStateManager } from "../world-state-types.js";
import type { IProviderRegistry, LLMProcess } from "../llm-types.js";
import type { PermissionVerdict } from "../permission-engine.js";
import type { IFileSystem, IPaths, IClock } from "../../../infrastructure/types.js";

// ── Goal Types ───────────────────────────────────────────────────────

export type GoalType = "review" | "summarize" | "plan" | "implement" | "monitor" | "report";

const GOAL_TYPES: readonly GoalType[] = ["review", "summarize", "plan", "implement", "monitor", "report"];

/** Extract goal type from a goal name string (first word match, case-insensitive). */
export function parseGoalType(goalName: string): GoalType | undefined {
	const lower = goalName.toLowerCase();
	return GOAL_TYPES.find((t) => lower.startsWith(t));
}

// ── Agent Needs (Phase 2 — liveness-systems prerequisite) ────────────

export interface AgentNeeds {
	energy: number;
	social: number;
	focus: number;
	morale: number;
}

export function createDefaultNeeds(): AgentNeeds {
	return { energy: 80, social: 60, focus: 70, morale: 75 };
}

// ── Sensor Events (Phase 2 — liveness-systems prerequisite) ──────────

export interface BTSensorEvent {
	readonly type: string;
	readonly source: string;
	readonly timestamp: string;
	readonly data: Record<string, unknown>;
}

// ── LLM Async Slot ───────────────────────────────────────────────────

export type LLMSlotState = "idle" | "pending" | "resolved" | "failed";

export interface LLMSlot {
	state: LLMSlotState;
	process: LLMProcess | null;
	result: string | null;
}

export function createIdleLLMSlot(): LLMSlot {
	return { state: "idle", process: null, result: null };
}

// ── Tool Dependencies ────────────────────────────────────────────────
// IFileSystem, IPaths, IClock imported from infrastructure/types.ts
// (type-only imports from infra are allowed — ESLint only blocks node built-in singletons)

export type { IFileSystem, IPaths, IClock };

export interface AgentToolDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly clock: IClock;
	readonly providerRegistry?: IProviderRegistry;
	readonly worldState: IWorldStateManager;
	readonly checkPermission: (tool: string) => PermissionVerdict;
}

// ── BTAgent Context (Blackboard) ─────────────────────────────────────

export interface BTAgentContext {
	readonly name: string;
	readonly persona: string | undefined;
	readonly domain: string | undefined;
	readonly attributes: AgentAttributes;
	readonly personality: readonly string[];
	readonly experience: number;

	needs: AgentNeeds;
	goals: readonly AgentGoal[];
	activeGoal: AgentGoal | null;
	activeGoalFile: string | null;
	pendingEvent: BTSensorEvent | null;
	nearbyAgents: readonly string[];

	lastFileContent: string | null;
	lastLLMResult: string | null;
	lastWrittenPath: string | null;
	workingFilePath: string | null;
	llmSlot: LLMSlot;
}

// ── Goal Subtree Config ──────────────────────────────────────────────

export interface GoalSubtreeConfig {
	readonly goalType: GoalType;
	readonly mdsl: string;
	readonly promptInstruction: string;
}

// ── Collected Actions ────────────────────────────────────────────────

export interface CollectedAction {
	readonly type: string;
	readonly data: Record<string, unknown>;
}
