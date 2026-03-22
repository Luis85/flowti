/**
 * bt-types.ts — Type definitions for the behavior tree agent system.
 *
 * Domain-layer pure. No I/O, no infrastructure imports.
 * See spec: docs/specs/2026-03-20-agent-behavior-trees-and-tools-design.md
 */

import type { AgentAttributes, AgentGoal } from "../../data/types.js";
import type { IEchoStore } from "../../systems/echo/echo-types.js";

// ── Deps interfaces (Plugin-native) ──────────────────────────────────

export interface IFileSystem {
	readFileSync(path: string, encoding: string): string;
	writeFileSync(path: string, content: string, encoding: string): void;
	existsSync(path: string): boolean;
	mkdirSync(path: string, opts?: { recursive?: boolean }): void;
}

export interface IPaths {
	join(...segments: string[]): string;
	dirname(p: string): string;
	basename(p: string): string;
}

export interface IClock {
	now(): number;
	ms(): number;
	iso(): string;
}

export type PermissionVerdict = "allowed" | "denied" | "prompt-user" | "queued";

export interface LLMProcess {
	readonly result: Promise<{ text: string }>;
	kill(): void;
}

export interface IProviderRegistry {
	list(): readonly unknown[];
	select(options: { preferred?: string; taskType: string }): { provider: { execute(request: { prompt: { message: string; system?: string } }): LLMProcess } };
}

export interface IWorldStateManager {
	emitAction(action: { id: string; agentName: string; timestamp: string; type: string; data: Record<string, unknown> }): void;
	updateEntity(id: string, type: string, components: Record<string, unknown>): void;
}

// ── BTAgent Definition (boundary contract) ──────────────────────────

export interface BTAgentDef {
	readonly name: string;
	readonly agentType: string;
	readonly domain?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly experience?: number;
	readonly attributes?: AgentAttributes;
	readonly goals?: readonly AgentGoal[];
	readonly behaviors?: readonly string[];
	readonly trustTier?: "supervised" | "trusted" | "autonomous";
	readonly quirks?: readonly string[];
}

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
	hunger: number;
	thirst: number;
}

export function createDefaultNeeds(): AgentNeeds {
	return { energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80 };
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

export interface INeedsBridge {
	getNeeds: (name: string) => AgentNeeds;
}

export interface IBrainBridge {
	assignWork: (name: string) => void;
	releaseWork: (name: string) => void;
	applyEvent: (name: string, event: string) => void;
	getState: (name: string) => string;
}

export interface IMerchantBridge {
	shouldAutoPurchase: (agentName: string) => boolean;
	getAutoPurchaseItemId: (agentName: string) => string | undefined;
	purchase: (agentName: string, itemId: string) => Promise<{ success: boolean; message: string }>;
	getCycleCount: () => number;
}

export interface AgentToolDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly clock: IClock;
	readonly providerRegistry?: IProviderRegistry;
	readonly worldState: IWorldStateManager;
	readonly checkPermission: (tool: string) => PermissionVerdict;
	readonly needs?: INeedsBridge;
	readonly brain?: IBrainBridge;
	readonly merchant?: IMerchantBridge;
}

// ── Interaction Hooks (optional — wired when interaction system is active) ──

export interface InteractionHooks {
	getNearby: () => Array<{ id: string; entityType: string; distance: number }>;
	resolve: () => Array<{ id: string; action: string }>;
	submit: (interaction: { id: string; action: string }) => boolean;
}

// ── BTAgent Context (Blackboard) ─────────────────────────────────────

export interface BTAgentContext {
	readonly name: string;
	readonly persona: string | undefined;
	readonly domain: string | undefined;
	readonly attributes: AgentAttributes;
	readonly personality: readonly string[];
	readonly experience: number;
	readonly quirks: readonly string[];

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
	lastMerchantVisitCycle: number;
	activeInteraction: { id: string; action: string } | null;
	interactionHooks?: InteractionHooks;
	echoStore?: IEchoStore;
	currentRoom?: string;
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

// ── Minimal BT agent contract for the tick system ───────────────────
// AgentBT.agent is typed as BtAgentBase so PetBTObject (which has no
// full BTAgentObject method set) can satisfy it without unsafe casts.

export interface BtAgentBase {
	readonly collectedActions: CollectedAction[];
	readonly context: { readonly name: string };
}
