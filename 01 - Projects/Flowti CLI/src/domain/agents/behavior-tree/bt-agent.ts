/**
 * bt-agent.ts — BTAgent object factory.
 *
 * Creates the agent object that mistreevous binds to. Contains all action
 * methods, condition methods, and the shared context (blackboard).
 * Domain-layer pure — all I/O via injected deps.
 */

import { State } from "mistreevous";
import type { AgentSummary } from "../agent-types.js";
import { hasLLMProvider } from "../llm-availability.js";
import { generateFromTemplate } from "./templates/template-engine.js";
import { assemblePrompt } from "./bt-prompt.js";
import {
	createDefaultNeeds,
	createIdleLLMSlot,
	parseGoalType,
	type AgentToolDeps,
	type BTAgentContext,
	type CollectedAction,
} from "./bt-types.js";

export interface BTAgentObject {
	readonly context: BTAgentContext;
	readonly collectedActions: CollectedAction[];

	// Conditions (return boolean)
	HasEnoughEnergy(): boolean;
	HasEnoughFocus(): boolean;
	HasEnoughMorale(): boolean;
	HasActiveGoal(): boolean;
	HasGoalFile(): boolean;
	HasLLMProvider(): boolean;
	HasNearbyAgent(): boolean;
	HasPendingEvent(): boolean;
	HasFileContent(): boolean;
	HasLLMResult(): boolean;

	// Actions (return State)
	PickGoal(): State;
	PickGoalFile(): State;
	ReadFile(): State;
	WriteFile(): State;
	OpenInVault(): State;
	QueryLLM(): State;
	GenerateFromTemplate(): State;
	DropArtifact(): State;
	SpeakBubble(): State;
	Wander(): State;
	Emote(): State;
	Chatter(): State;
	Socialize(): State;
	Rest(): State;
	HandleEvent(): State;
}

export function createBTAgent(agent: AgentSummary, deps: AgentToolDeps): BTAgentObject {
	const attr = agent.attributes ?? {};
	const con = attr.con ?? 10;
	const int_ = attr.int ?? 10;
	const wis = attr.wis ?? 10;
	const str = attr.str ?? 10;

	const context: BTAgentContext = {
		name: agent.name,
		persona: agent.persona,
		domain: agent.domain,
		attributes: attr,
		personality: agent.personality ?? [],
		experience: agent.experience ?? 0,
		needs: createDefaultNeeds(),
		goals: agent.goals ?? [],
		activeGoal: null,
		activeGoalFile: null,
		pendingEvent: null,
		nearbyAgents: [],
		lastFileContent: null,
		lastLLMResult: null,
		lastWrittenPath: null,
		workingFilePath: null,
		llmSlot: createIdleLLMSlot(),
	};

	const collectedActions: CollectedAction[] = [];

	function collect(type: string, data: Record<string, unknown> = {}): void {
		collectedActions.push({ type, data });
	}

	// ── Conditions ───────────────────────────────────────────────────

	function HasEnoughEnergy(): boolean {
		return context.needs.energy > (30 - con / 2);
	}

	function HasEnoughFocus(): boolean {
		return context.needs.focus > (20 - int_ / 3);
	}

	function HasEnoughMorale(): boolean {
		return context.needs.morale > 10;
	}

	function HasActiveGoal(): boolean {
		return context.activeGoal !== null;
	}

	function HasGoalFile(): boolean {
		return context.activeGoalFile !== null;
	}

	function HasLLMProvider(): boolean {
		return hasLLMProvider(deps.providerRegistry);
	}

	function HasNearbyAgent(): boolean {
		return context.nearbyAgents.length > 0;
	}

	function HasPendingEvent(): boolean {
		return context.pendingEvent !== null;
	}

	function HasFileContent(): boolean {
		return context.lastFileContent !== null;
	}

	function HasLLMResult(): boolean {
		return context.llmSlot.state === "resolved" && context.llmSlot.result !== null;
	}

	// ── Actions ──────────────────────────────────────────────────────

	function PickGoal(): State {
		const goals = context.goals;
		if (goals.length === 0) return State.FAILED;

		let picked;
		if (wis >= 14) {
			picked = [...goals].sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1))[0];
		} else {
			picked = goals[Math.floor(Math.random() * goals.length)];
		}

		(context as { activeGoal: typeof picked }).activeGoal = picked;
		collect("goal-started", { goalName: picked.name });
		return State.SUCCEEDED;
	}

	function PickGoalFile(): State {
		if (!context.activeGoal) return State.FAILED;
		const goalName = context.activeGoal.name;
		const words = goalName.split(/\s+/).slice(1);
		const fileName = words.join("-") + ".md";
		(context as { activeGoalFile: string }).activeGoalFile = fileName;
		(context as { workingFilePath: string }).workingFilePath = fileName;
		return State.SUCCEEDED;
	}

	function ReadFile(): State {
		const verdict = deps.checkPermission("Read");
		if (verdict !== "allowed") return State.FAILED;

		const filePath = context.workingFilePath ?? context.activeGoalFile;
		if (!filePath) return State.FAILED;

		try {
			const content = deps.disk.readFileSync(filePath, "utf-8");
			(context as { lastFileContent: string }).lastFileContent = content;
			collect("file-read", { filePath });
			return State.SUCCEEDED;
		} catch {
			return State.FAILED;
		}
	}

	function WriteFile(): State {
		const verdict = deps.checkPermission("Write");
		if (verdict !== "allowed") return State.FAILED;

		const content = context.lastLLMResult;
		if (!content) return State.FAILED;

		const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "note") : "note";
		const outPath = deps.paths.join("artifacts", `${context.name}-${goalType}-${deps.clock.ms()}.md`);

		try {
			deps.disk.writeFileSync(outPath, content, "utf-8");
			(context as { lastWrittenPath: string }).lastWrittenPath = outPath;
			collect("file-written", { filePath: outPath });
			return State.SUCCEEDED;
		} catch {
			return State.FAILED;
		}
	}

	function OpenInVault(): State {
		const filePath = context.lastWrittenPath ?? context.workingFilePath;
		if (!filePath) return State.FAILED;
		collect("file-opened", { filePath });
		return State.SUCCEEDED;
	}

	function QueryLLM(): State {
		// Guard: only start once
		if (context.llmSlot.state === "idle") {
			if (!deps.providerRegistry) return State.FAILED;

			const selection = deps.providerRegistry.select({
				preferred: undefined,
				taskType: "autonomous",
			});

			const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "review") : "review";
			const prompt = assemblePrompt(context, goalType, int_);

			const process = selection.provider.execute({
				prompt: {
					message: prompt,
					system: `You are ${context.persona ?? context.name}, a ${context.domain ?? "general"} specialist.`,
				},
			});

			context.llmSlot.state = "pending";
			context.llmSlot.process = process;

			process.result
				.then((result) => {
					context.llmSlot.state = "resolved";
					context.llmSlot.result = result.text;
				})
				.catch(() => {
					context.llmSlot.state = "failed";
				});

			collect("thinking", {});
			return State.RUNNING;
		}

		// Poll
		if (context.llmSlot.state === "pending") return State.RUNNING;

		if (context.llmSlot.state === "resolved") {
			(context as { lastLLMResult: string | null }).lastLLMResult = context.llmSlot.result;
			context.llmSlot.state = "idle";
			context.llmSlot.process = null;
			context.llmSlot.result = null;
			return State.SUCCEEDED;
		}

		// Failed
		context.llmSlot.state = "idle";
		context.llmSlot.process = null;
		return State.FAILED;
	}

	function GenerateFromTemplate(): State {
		const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "review") : "review";
		const result = generateFromTemplate({
			goalType,
			fileName: context.activeGoalFile ?? "unknown",
			fileContent: context.lastFileContent ?? "",
			agentName: context.name,
			persona: context.persona,
			mood: agent.mood ?? "neutral",
			timestamp: deps.clock.iso(),
		});
		(context as { lastLLMResult: string }).lastLLMResult = result;
		collect("template-generated", { goalType });
		return State.SUCCEEDED;
	}

	function DropArtifact(): State {
		if (!context.lastWrittenPath) return State.FAILED;
		const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "note") : "note";
		const entityId = `artifact-${context.name}-${deps.clock.ms()}`;

		deps.worldState.updateEntity(entityId, "artifact", {
			filePath: context.lastWrittenPath,
			droppedBy: context.name,
			droppedAt: deps.clock.iso(),
			goalType,
			position: "near-agent",
			picked: false,
		});

		collect("artifact-dropped", {
			filePath: context.lastWrittenPath,
			goalType,
			entityId,
		});

		// STR >= 14: auto-open assertiveness
		if (str >= 14) OpenInVault();

		return State.SUCCEEDED;
	}

	function SpeakBubble(): State {
		const text = context.lastLLMResult?.slice(0, 120) ?? "...";
		collect("speaking", { text, source: "bt" });
		return State.SUCCEEDED;
	}

	function Wander(): State {
		collect("idle", {});
		return State.SUCCEEDED;
	}

	function Emote(): State {
		collect("idle", {});
		return State.SUCCEEDED;
	}

	function Chatter(): State {
		collect("speaking", { text: "", source: "chatter" });
		return State.SUCCEEDED;
	}

	function Socialize(): State {
		if (context.nearbyAgents.length === 0) return State.FAILED;
		collect("speaking", { text: "", source: "social", target: context.nearbyAgents[0] });
		return State.SUCCEEDED;
	}

	function Rest(): State {
		context.needs.energy = Math.min(100, context.needs.energy + 5);
		collect("idle", {});
		return State.SUCCEEDED;
	}

	function HandleEvent(): State {
		if (!context.pendingEvent) return State.FAILED;
		const event = context.pendingEvent;
		(context as { pendingEvent: null }).pendingEvent = null;
		collect("speaking", { text: `Reacting to ${event.type}`, source: "event" });
		return State.SUCCEEDED;
	}

	return {
		context,
		collectedActions,
		HasEnoughEnergy, HasEnoughFocus, HasEnoughMorale,
		HasActiveGoal, HasGoalFile, HasLLMProvider,
		HasNearbyAgent, HasPendingEvent, HasFileContent, HasLLMResult,
		PickGoal, PickGoalFile, ReadFile, WriteFile, OpenInVault,
		QueryLLM, GenerateFromTemplate, DropArtifact, SpeakBubble,
		Wander, Emote, Chatter, Socialize, Rest, HandleEvent,
	};
}
