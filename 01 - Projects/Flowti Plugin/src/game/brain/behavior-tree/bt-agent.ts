/**
 * bt-agent.ts — BTAgent object factory.
 *
 * Creates the agent object that mistreevous binds to. Contains all action
 * methods, condition methods, and the shared context (blackboard).
 * Domain-layer pure — all I/O via injected deps.
 */

import { fromNodeState, type State } from "./bt-service.js";
import { generateFromTemplate } from "./templates/template-engine.js";
import { assemblePrompt } from "./bt-prompt.js";
import {
	createDefaultNeeds,
	createIdleLLMSlot,
	parseGoalType,
	type AgentToolDeps,
	type BTAgentContext,
	type BTAgentDef,
	type CollectedAction,
	type IProviderRegistry,
} from "./bt-types.js";

function hasLLMProvider(registry?: IProviderRegistry): boolean {
	if (!registry) return false;
	return registry.list().length > 0;
}

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

	// Needs-driven conditions
	IsEnergyLow(): boolean;
	IsSocialLow(): boolean;
	IsFocusLow(): boolean;
	IsMoraleLow(): boolean;
	IsHungry(): boolean;
	IsThirsty(): boolean;
	IsEnergyOk(): boolean;
	IsFocusOk(): boolean;
	HasWorkGoal(): boolean;

	// Journey conditions
	HasJourneyTask(): boolean;

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

	// Needs-driven actions
	SeekRestSpot(): State;
	SeekNearbyAgent(): State;
	SeekQuietCorner(): State;
	SeekFoodStation(): State;
	SeekDrinkStation(): State;
	Eat(): State;
	Drink(): State;
	WanderSad(): State;
	GoToWorkstation(): State;
	DoWork(): State;
	LeaveWorkstation(): State;

	// Journey actions
	ExecuteJourney(): State;
}

export function createBTAgent(agent: BTAgentDef, deps: AgentToolDeps): BTAgentObject {
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

	// ── Needs-driven conditions ─────────────────────────────────────

	function IsEnergyLow(): boolean {
		return context.needs.energy < (30 - con / 2);
	}

	function IsSocialLow(): boolean {
		return context.needs.social < 25;
	}

	function IsFocusLow(): boolean {
		return context.needs.focus < (20 - int_ / 3);
	}

	function IsMoraleLow(): boolean {
		return context.needs.morale < 10;
	}

	function IsHungry(): boolean {
		return context.needs.hunger < 35;
	}

	function IsThirsty(): boolean {
		return context.needs.thirst < 30;
	}

	function IsEnergyOk(): boolean {
		return context.needs.energy > 60;
	}

	function IsFocusOk(): boolean {
		return context.needs.focus > 50;
	}

	function HasWorkGoal(): boolean {
		return context.goals.length > 0
			&& context.needs.energy > 50
			&& context.needs.focus > 40;
	}

	// Stub: no journey tasks assigned via this system yet (SSE wiring deferred)
	function HasJourneyTask(): boolean {
		return false;
	}

	// ── Actions ──────────────────────────────────────────────────────

	function PickGoal(): State {
		const goals = context.goals;
		if (goals.length === 0) return fromNodeState("failed");

		let picked;
		if (wis >= 14) {
			picked = [...goals].sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1))[0];
		} else {
			picked = goals[Math.floor(Math.random() * goals.length)];
		}

		(context as { activeGoal: typeof picked }).activeGoal = picked;
		collect("goal-started", { goalName: picked.name });
		return fromNodeState("succeeded");
	}

	function PickGoalFile(): State {
		if (!context.activeGoal) return fromNodeState("failed");
		const goalName = context.activeGoal.name;
		const words = goalName.split(/\s+/).slice(1);
		const fileName = words.join("-") + ".md";
		(context as { activeGoalFile: string }).activeGoalFile = fileName;
		(context as { workingFilePath: string }).workingFilePath = fileName;
		return fromNodeState("succeeded");
	}

	function ReadFile(): State {
		const verdict = deps.checkPermission("Read");
		if (verdict !== "allowed") return fromNodeState("failed");

		const filePath = context.workingFilePath ?? context.activeGoalFile;
		if (!filePath) return fromNodeState("failed");

		try {
			const content = deps.disk.readFileSync(filePath, "utf-8");
			(context as { lastFileContent: string }).lastFileContent = content;
			collect("file-read", { filePath });
			return fromNodeState("succeeded");
		} catch {
			return fromNodeState("failed");
		}
	}

	function WriteFile(): State {
		const verdict = deps.checkPermission("Write");
		if (verdict !== "allowed") return fromNodeState("failed");

		const content = context.lastLLMResult;
		if (!content) return fromNodeState("failed");

		const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "note") : "note";
		const outPath = deps.paths.join("artifacts", `${context.name}-${goalType}-${deps.clock.ms()}.md`);

		try {
			deps.disk.writeFileSync(outPath, content, "utf-8");
			(context as { lastWrittenPath: string }).lastWrittenPath = outPath;
			collect("file-written", { filePath: outPath });
			return fromNodeState("succeeded");
		} catch {
			return fromNodeState("failed");
		}
	}

	function OpenInVault(): State {
		const filePath = context.lastWrittenPath ?? context.workingFilePath;
		if (!filePath) return fromNodeState("failed");
		collect("file-opened", { filePath });
		return fromNodeState("succeeded");
	}

	function QueryLLM(): State {
		// Guard: only start once
		if (context.llmSlot.state === "idle") {
			if (!deps.providerRegistry) return fromNodeState("failed");

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
			return fromNodeState("running");
		}

		// Poll
		if (context.llmSlot.state === "pending") return fromNodeState("running");

		if (context.llmSlot.state === "resolved") {
			(context as { lastLLMResult: string | null }).lastLLMResult = context.llmSlot.result;
			context.llmSlot.state = "idle";
			context.llmSlot.process = null;
			context.llmSlot.result = null;
			return fromNodeState("succeeded");
		}

		// Failed
		context.llmSlot.state = "idle";
		context.llmSlot.process = null;
		return fromNodeState("failed");
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
		return fromNodeState("succeeded");
	}

	function DropArtifact(): State {
		if (!context.lastWrittenPath) return fromNodeState("failed");
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

		return fromNodeState("succeeded");
	}

	function SpeakBubble(): State {
		const text = context.lastLLMResult?.slice(0, 120) ?? "...";
		collect("speaking", { text, source: "bt" });
		return fromNodeState("succeeded");
	}

	function Wander(): State {
		collect("idle", {});
		return fromNodeState("succeeded");
	}

	function Emote(): State {
		collect("idle", {});
		return fromNodeState("succeeded");
	}

	function Chatter(): State {
		collect("speaking", { text: "", source: "chatter" });
		return fromNodeState("succeeded");
	}

	function Socialize(): State {
		if (context.nearbyAgents.length === 0) return fromNodeState("failed");
		collect("speaking", { text: "", source: "social", target: context.nearbyAgents[0] });
		return fromNodeState("succeeded");
	}

	function Rest(): State {
		context.needs.energy = Math.min(100, context.needs.energy + 5);
		collect("idle", {});
		return fromNodeState("succeeded");
	}

	function HandleEvent(): State {
		if (!context.pendingEvent) return fromNodeState("failed");
		const event = context.pendingEvent;
		(context as { pendingEvent: null }).pendingEvent = null;
		collect("speaking", { text: `Reacting to ${event.type}`, source: "event" });
		return fromNodeState("succeeded");
	}

	// ── Needs-driven actions ────────────────────────────────────────

	function SeekRestSpot(): State {
		collect("seek-rest", {});
		deps.brain?.applyEvent(context.name, "seek-rest");
		return fromNodeState("succeeded");
	}

	function SeekNearbyAgent(): State {
		if (context.nearbyAgents.length === 0) {
			collect("seek-agent", {});
			deps.brain?.applyEvent(context.name, "seek-agent");
		} else {
			collect("speaking", { text: "", source: "social", target: context.nearbyAgents[0] });
			deps.brain?.applyEvent(context.name, "talking");
		}
		return fromNodeState("succeeded");
	}

	function SeekQuietCorner(): State {
		collect("seek-quiet", {});
		deps.brain?.applyEvent(context.name, "seek-quiet");
		return fromNodeState("succeeded");
	}

	function SeekFoodStation(): State {
		collect("seek-food", {});
		deps.brain?.applyEvent(context.name, "seek-food");
		return fromNodeState("succeeded");
	}

	function SeekDrinkStation(): State {
		collect("seek-drink", {});
		deps.brain?.applyEvent(context.name, "seek-drink");
		return fromNodeState("succeeded");
	}

	function Eat(): State {
		context.needs.hunger = Math.min(100, context.needs.hunger + 30);
		collect("idle", {});
		return fromNodeState("succeeded");
	}

	function Drink(): State {
		context.needs.thirst = Math.min(100, context.needs.thirst + 30);
		collect("idle", {});
		return fromNodeState("succeeded");
	}

	function WanderSad(): State {
		collect("wander-sad", {});
		collect("idle", {});
		return fromNodeState("succeeded");
	}

	function GoToWorkstation(): State {
		collect("goal-started", { goalName: context.activeGoal?.name ?? "work" });
		deps.brain?.assignWork(context.name);
		return fromNodeState("succeeded");
	}

	function DoWork(): State {
		context.needs.focus = Math.max(0, context.needs.focus - 5);
		context.needs.morale = Math.min(100, context.needs.morale + 1);
		return fromNodeState("succeeded");
	}

	function LeaveWorkstation(): State {
		collect("goal-completed", { goalName: context.activeGoal?.name ?? "work" });
		deps.brain?.releaseWork(context.name);
		(context as { activeGoal: null }).activeGoal = null;
		return fromNodeState("succeeded");
	}

	// Stub: actual journey execution wires to SSE event contract (deferred)
	function ExecuteJourney(): State {
		return fromNodeState("succeeded");
	}

	return {
		context,
		collectedActions,
		HasEnoughEnergy, HasEnoughFocus, HasEnoughMorale,
		HasActiveGoal, HasGoalFile, HasLLMProvider,
		HasNearbyAgent, HasPendingEvent, HasFileContent, HasLLMResult,
		IsEnergyLow, IsSocialLow, IsFocusLow, IsMoraleLow,
		IsHungry, IsThirsty,
		IsEnergyOk, IsFocusOk, HasWorkGoal,
		HasJourneyTask,
		PickGoal, PickGoalFile, ReadFile, WriteFile, OpenInVault,
		QueryLLM, GenerateFromTemplate, DropArtifact, SpeakBubble,
		Wander, Emote, Chatter, Socialize, Rest, HandleEvent,
		SeekRestSpot, SeekNearbyAgent, SeekQuietCorner,
		SeekFoodStation, SeekDrinkStation, Eat, Drink,
		WanderSad,
		GoToWorkstation, DoWork, LeaveWorkstation,
		ExecuteJourney,
	};
}
