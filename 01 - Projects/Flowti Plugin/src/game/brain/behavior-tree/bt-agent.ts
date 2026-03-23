/**
 * bt-agent.ts — BTAgent object factory.
 *
 * Creates the agent object that mistreevous binds to. Contains all action
 * methods, condition methods, and the shared context.
 * Actions write to the agent's blackboard (via deps.blackboard) instead of
 * collecting actions. The blackboard is the single data bus between the BT
 * and all other systems (locomotion, presentation, needs).
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
	type IProviderRegistry,
} from "./bt-types.js";
import {
	IsHungry, IsThirsty, HasJourneyTask,
	SeekFoodStation, SeekDrinkStation, Eat, Drink, ExecuteJourney,
	IsMerchantEligible, HasNotVisitedMerchantThisCycle, HasAutoPurchaseAvailable,
	SeekMerchantStall, BrowseMerchant, ExecuteMerchantPurchase,
	HasPreferredFoodStation, HasPreferredDrinkStation,
	SeekPreferredFoodStation, SeekPreferredDrinkStation,
} from "./bt-agent-extensions.js";

function hasLLMProvider(registry?: IProviderRegistry): boolean {
	if (!registry) return false;
	return registry.list().length > 0;
}

/** Non-empty trimmed string, or undefined if missing/invalid. */
function trimmedGoalName(name: unknown): string | undefined {
	if (typeof name !== "string") return undefined;
	const t = name.trim();
	return t.length > 0 ? t : undefined;
}

/**
 * Filename stem: words after the first (goal type token). If only one word,
 * slugify the full name so we never produce ".md".
 */
function stemFromGoalName(trimmed: string): string {
	const words = trimmed.split(/\s+/);
	const tail = words.slice(1);
	if (tail.length > 0) return tail.join("-");
	const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	return slug || "goal";
}

export interface BTAgentObject {
	readonly context: BTAgentContext;
	// Conditions
	HasEnoughEnergy(): boolean; HasEnoughFocus(): boolean; HasEnoughMorale(): boolean;
	HasActiveGoal(): boolean; HasGoalFile(): boolean; HasLLMProvider(): boolean;
	HasNearbyAgent(): boolean; HasPendingEvent(): boolean; HasFileContent(): boolean; HasLLMResult(): boolean;
	// Needs-driven conditions
	IsEnergyLow(): boolean; IsSocialLow(): boolean; IsFocusLow(): boolean; IsMoraleLow(): boolean;
	IsHungry(): boolean; IsThirsty(): boolean; IsEnergyOk(): boolean; IsFocusOk(): boolean;
	HasWorkGoal(): boolean; HasJourneyTask(): boolean;
	IsMerchantEligible(): boolean; HasNotVisitedMerchantThisCycle(): boolean; HasAutoPurchaseAvailable(): boolean;
	// Preference conditions
	HasPreferredFoodStation(): boolean; HasPreferredDrinkStation(): boolean;
	// Interaction conditions
	NotInInteraction(): boolean; HasNearbyEntity(): boolean;
	// Idle-wander conditions
	IsIdleLongEnough(): boolean;
	// Talking timeout condition
	IsTalkingTooLong(): boolean;
	// Break condition
	NeedsBreak(): boolean;
	// Actions
	PickGoal(): State; PickGoalFile(): State; ReadFile(): State; WriteFile(): State; OpenInVault(): State;
	QueryLLM(): State; GenerateFromTemplate(): State; DropArtifact(): State; SpeakBubble(): State;
	Wander(): State; Emote(): State; Chatter(): State; Socialize(): State; Rest(): State; HandleEvent(): State;
	// Needs-driven + journey actions
	SeekRestSpot(): State; SeekNearbyAgent(): State; SeekQuietCorner(): State;
	SeekFoodStation(): State; SeekDrinkStation(): State; Eat(): State; Drink(): State;
	SeekPreferredFoodStation(): State; SeekPreferredDrinkStation(): State;
	WanderSad(): State; GoToWorkstation(): State; DoWork(): State; LeaveWorkstation(): State;
	ExecuteJourney(): State;
	SeekMerchantStall(): State; BrowseMerchant(): State; ExecuteMerchantPurchase(): State;
	// Interaction actions
	EvaluateInteraction(): State; SubmitInteraction(): State;
	// Idle fallback + new subtree actions
	EchoBiasedIdle(): State; CommandWander(): State; StartBreak(): State; StopTalking(): State;
}

export function createBTAgent(agent: BTAgentDef, deps: AgentToolDeps): BTAgentObject {
	const attr = agent.attributes ?? {};
	const con = attr.con ?? 10;
	const int_ = attr.int ?? 10;
	const wis = attr.wis ?? 10;
	const str = attr.str ?? 10;

	const trustTier = agent.trustTier;
	const bb = deps.blackboard;

	const context: BTAgentContext = {
		name: agent.name,
		persona: agent.persona,
		domain: agent.domain,
		attributes: attr,
		personality: agent.personality ?? [],
		xp: agent.xp ?? 0,
		level: agent.level ?? 1,
		quirks: agent.quirks ?? [],
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
		lastMerchantVisitCycle: -1,
		activeInteraction: null,
		intentTimer: 0,
		idleResistance: 4000 + (con / 20) * 8000,
	};

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

	// ── Idle-wander condition (replaces brain.updateIdle timer) ──────

	function IsIdleLongEnough(): boolean {
		return bb.intent === "idle" && !bb.isMoving && context.intentTimer >= context.idleResistance;
	}

	// ── Talking timeout condition (replaces brain talking/waiting 10s timeout) ──

	function IsTalkingTooLong(): boolean {
		return bb.intent === "talking" && context.intentTimer > 10_000;
	}

	// ── Break condition (replaces brain.updateWorking break threshold) ──

	function NeedsBreak(): boolean {
		return bb.intent === "working" && context.needs.energy < (30 - con / 2);
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
		bb.intent = "working";
		bb.intentDetail = `goal-${picked.name}`;
		return fromNodeState("succeeded");
	}

	function PickGoalFile(): State {
		if (!context.activeGoal) return fromNodeState("failed");
		const trimmed = trimmedGoalName(context.activeGoal.name);
		if (!trimmed) return fromNodeState("failed");
		const fileName = `${stemFromGoalName(trimmed)}.md`;
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

		const goalType = parseGoalType(trimmedGoalName(context.activeGoal?.name) ?? "") ?? "note";
		const outPath = deps.paths.join("artifacts", `${context.name}-${goalType}-${deps.clock.ms()}.md`);

		try {
			deps.disk.writeFileSync(outPath, content, "utf-8");
			(context as { lastWrittenPath: string }).lastWrittenPath = outPath;
			return fromNodeState("succeeded");
		} catch {
			return fromNodeState("failed");
		}
	}

	function OpenInVault(): State {
		const filePath = context.lastWrittenPath ?? context.workingFilePath;
		if (!filePath) return fromNodeState("failed");
		return fromNodeState("succeeded");
	}

	function QueryLLM(): State {
		if (context.llmSlot.state === "idle") {
			if (!deps.providerRegistry) return fromNodeState("failed");

			const selection = deps.providerRegistry.select({
				preferred: undefined,
				taskType: "autonomous",
			});

			const goalType = parseGoalType(trimmedGoalName(context.activeGoal?.name) ?? "") ?? "review";
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

			bb.intent = "working";
			bb.intentDetail = "thinking";
			return fromNodeState("running");
		}

		if (context.llmSlot.state === "pending") return fromNodeState("running");

		if (context.llmSlot.state === "resolved") {
			(context as { lastLLMResult: string | null }).lastLLMResult = context.llmSlot.result;
			context.llmSlot.state = "idle";
			context.llmSlot.process = null;
			context.llmSlot.result = null;
			return fromNodeState("succeeded");
		}

		context.llmSlot.state = "idle";
		context.llmSlot.process = null;
		return fromNodeState("failed");
	}

	function GenerateFromTemplate(): State {
		const goalType = parseGoalType(trimmedGoalName(context.activeGoal?.name) ?? "") ?? "review";
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
		return fromNodeState("succeeded");
	}

	function DropArtifact(): State {
		if (!context.lastWrittenPath) return fromNodeState("failed");
		if (str >= 14) OpenInVault();
		bb.intent = "idle";
		bb.intentDetail = "";
		return fromNodeState("succeeded");
	}

	function SpeakBubble(): State {
		const raw = context.lastLLMResult;
		const text = raw && raw.trim() ? raw.slice(0, 120) : "";
		if (text) {
			bb.speechRequest = { text, kind: "speech" };
		}
		return fromNodeState("succeeded");
	}

	function Wander(): State {
		bb.intent = "idle";
		bb.intentDetail = "";
		return fromNodeState("succeeded");
	}

	function Emote(): State {
		bb.intent = "idle";
		bb.intentDetail = "";
		return fromNodeState("succeeded");
	}

	function Chatter(): State {
		bb.intent = "idle";
		bb.intentDetail = "";
		return fromNodeState("succeeded");
	}

	function Socialize(): State {
		if (context.nearbyAgents.length === 0) return fromNodeState("failed");
		bb.intent = "talking";
		bb.intentDetail = "social";
		return fromNodeState("succeeded");
	}

	function Rest(): State {
		context.needs.energy = Math.min(100, context.needs.energy + 5);
		return fromNodeState("succeeded");
	}

	function HandleEvent(): State {
		if (!context.pendingEvent) return fromNodeState("failed");
		const event = context.pendingEvent;
		(context as { pendingEvent: null }).pendingEvent = null;
		bb.speechRequest = { text: `Reacting to ${event.type}`, kind: "speech" };
		return fromNodeState("succeeded");
	}

	// ── Interaction conditions + actions ──────────────────────────────

	function NotInInteraction(): boolean {
		return context.activeInteraction === null;
	}

	function HasNearbyEntity(): boolean {
		const hooks = context.interactionHooks;
		if (!hooks) return true;
		return hooks.getNearby().length > 0;
	}

	function EvaluateInteraction(): State {
		const hooks = context.interactionHooks;
		if (!hooks) return fromNodeState("succeeded");

		const candidates = hooks.resolve();
		if (candidates.length === 0) return fromNodeState("failed");

		(context as { activeInteraction: { id: string; action: string } }).activeInteraction = candidates[0];
		return fromNodeState("succeeded");
	}

	function SubmitInteraction(): State {
		const interaction = context.activeInteraction;
		if (!interaction) return fromNodeState("failed");

		const hooks = context.interactionHooks;
		const accepted = hooks ? hooks.submit(interaction) : true;

		(context as { activeInteraction: null }).activeInteraction = null;

		if (accepted) return fromNodeState("succeeded");
		return fromNodeState("failed");
	}

	// ── Idle fallback ────────────────────────────────────────────────

	function EchoBiasedIdle(): State {
		bb.intent = "idle";
		bb.intentDetail = "";
		return fromNodeState("succeeded");
	}

	// ── New subtree actions (idle-wander, break, talking timeout) ────

	function CommandWander(): State {
		bb.movementCommand = "wander";
		context.intentTimer = 0;
		return fromNodeState("succeeded");
	}

	function StartBreak(): State {
		bb.intent = "on-break";
		bb.intentDetail = "break";
		bb.movementCommand = "walk-to";
		bb.movementTarget = bb.nearestRestStation;
		return fromNodeState("succeeded");
	}

	function StopTalking(): State {
		bb.intent = "idle";
		bb.intentDetail = "";
		context.intentTimer = 0;
		return fromNodeState("succeeded");
	}

	// ── Needs-driven actions ────────────────────────────────────────

	function SeekRestSpot(): State {
		bb.intent = "seeking";
		bb.intentDetail = "seek-rest";
		bb.movementCommand = "walk-to";
		bb.movementTarget = bb.nearestRestStation;
		return fromNodeState("succeeded");
	}

	function SeekNearbyAgent(): State {
		if (context.nearbyAgents.length === 0) {
			bb.intent = "seeking";
			bb.intentDetail = "seek-agent";
			bb.movementCommand = "wander";
		} else {
			bb.intent = "talking";
			bb.intentDetail = "social";
		}
		return fromNodeState("succeeded");
	}

	function SeekQuietCorner(): State {
		bb.intent = "seeking";
		bb.intentDetail = "seek-quiet";
		bb.movementCommand = "wander";
		return fromNodeState("succeeded");
	}

	function WanderSad(): State {
		bb.intent = "idle";
		bb.intentDetail = "demoralized";
		bb.movementCommand = "wander";
		return fromNodeState("succeeded");
	}

	function GoToWorkstation(): State {
		bb.intent = "working";
		bb.intentDetail = `goal-${context.activeGoal?.name ?? "work"}`;
		// Workstation target will be resolved by the locomotion/blackboard push
		bb.movementCommand = "walk-to";
		bb.movementTarget = null; // resolved by station resolver
		return fromNodeState("succeeded");
	}

	function DoWork(): State {
		context.needs.focus = Math.max(0, context.needs.focus - 5);
		context.needs.morale = Math.min(100, context.needs.morale + 1);
		return fromNodeState("succeeded");
	}

	function LeaveWorkstation(): State {
		bb.intent = "idle";
		bb.intentDetail = "";
		(context as { activeGoal: null }).activeGoal = null;
		return fromNodeState("succeeded");
	}

	const extDeps = { context, deps };
	return {
		context,
		HasEnoughEnergy, HasEnoughFocus, HasEnoughMorale,
		HasActiveGoal, HasGoalFile, HasLLMProvider,
		HasNearbyAgent, HasPendingEvent, HasFileContent, HasLLMResult,
		IsEnergyLow, IsSocialLow, IsFocusLow, IsMoraleLow,
		IsHungry: () => IsHungry(context),
		IsThirsty: () => IsThirsty(context),
		IsEnergyOk, IsFocusOk, HasWorkGoal, NotInInteraction, HasNearbyEntity,
		IsIdleLongEnough, IsTalkingTooLong, NeedsBreak,
		HasJourneyTask: () => HasJourneyTask(context),
		IsMerchantEligible: () => IsMerchantEligible(context, trustTier),
		HasNotVisitedMerchantThisCycle: () => HasNotVisitedMerchantThisCycle(
			context, () => deps.merchant?.getCycleCount() ?? 0,
		),
		HasAutoPurchaseAvailable: () => HasAutoPurchaseAvailable(extDeps),
		HasPreferredFoodStation: () => HasPreferredFoodStation(context),
		HasPreferredDrinkStation: () => HasPreferredDrinkStation(context),
		PickGoal, PickGoalFile, ReadFile, WriteFile, OpenInVault,
		QueryLLM, GenerateFromTemplate, DropArtifact, SpeakBubble,
		Wander, Emote, Chatter, Socialize, Rest, HandleEvent,
		SeekRestSpot, SeekNearbyAgent, SeekQuietCorner,
		SeekFoodStation: () => SeekFoodStation(extDeps),
		SeekDrinkStation: () => SeekDrinkStation(extDeps),
		SeekPreferredFoodStation: () => SeekPreferredFoodStation(extDeps),
		SeekPreferredDrinkStation: () => SeekPreferredDrinkStation(extDeps),
		Eat: () => Eat(context),
		Drink: () => Drink(context),
		WanderSad,
		GoToWorkstation, DoWork, LeaveWorkstation,
		ExecuteJourney,
		SeekMerchantStall: () => SeekMerchantStall(extDeps),
		BrowseMerchant: () => BrowseMerchant(extDeps),
		ExecuteMerchantPurchase: () => ExecuteMerchantPurchase(extDeps),
		EvaluateInteraction, SubmitInteraction,
		EchoBiasedIdle,
		CommandWander, StartBreak, StopTalking,
	};
}
