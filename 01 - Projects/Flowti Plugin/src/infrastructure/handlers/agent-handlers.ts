/**
 * Agent sidepanel handler — bridges Lit component ↔ EventBus ↔ ICliExecutor.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../events/types.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../agents/cli-executor.js";
import type { IContextProvider } from "../../domain/agents/context-provider.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import type { AgentCard, ConversationMode } from "../../domain/agents/types.js";
import type { AgentBlueprint } from "../../domain/projects/types.js";
import type { FlowtiSettings } from "../../domain/settings/settings.js";
import { extractAgentMessage } from "../../game/data/message-utils.js";
import { parseFrontmatter, parseSuggestedTask } from "../../game/config/agent-markdown-roster.js";
import {
	agentVaultPaths,
	bodyAfterAgentFrontmatter,
} from "../../domain/projects/agent-note-builder.js";
import { saveAgentDefinition, deleteAgentDefinition } from "../agents/agent-vault-write.js";
import type { FlowtiAgentManage } from "../../components/agents/flowti-agent-manage.js";
import type { VaultFileAdapter } from "../vault-adapter.js";

export { parseSuggestedTask } from "../../game/config/agent-markdown-roster.js";

// Side-effect import: register the Lit custom element
import "../../components/agents/flowti-agent-sidepanel.js";

export type { VaultFileAdapter } from "../vault-adapter.js";

/** Minimal turn structure for local conversation tracking. */
interface LocalTurn {
	readonly role: "user" | "assistant";
	readonly text: string;
	readonly agent: string;
	readonly mode: ConversationMode;
	readonly timestamp: string;
}

export interface AgentHandlerDeps {
	readonly eventBus: IEventBus;
	readonly cliExecutor?: ICliExecutor;
	readonly contextProvider?: IContextProvider;
	readonly worldContext?: WorldContext;
	readonly vaultAdapter?: VaultFileAdapter;
	readonly agentsDir?: string;
	readonly vaultBasePath?: string;
	readonly app: App;
	readonly getSettings: () => FlowtiSettings;
}

function parseCompanionJsonRecord(text: string): Record<string, unknown> {
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return {};
	}
}

function blueprintAiFromCompanion(aiRaw: unknown): AgentBlueprint["ai"] | undefined {
	if (!aiRaw || typeof aiRaw !== "object") return undefined;
	const o = aiRaw as Record<string, unknown>;
	const modeRaw = (o.permissions as Record<string, unknown> | undefined)?.mode;
	const mode =
		modeRaw === "ask" || modeRaw === "auto-allow" || modeRaw === "trust" ? modeRaw : undefined;
	return {
		provider: typeof o.provider === "string" ? o.provider : undefined,
		systemPrompt: typeof o.systemPrompt === "string" ? o.systemPrompt : undefined,
		allowedTools: Array.isArray(o.allowedTools)
			? o.allowedTools.filter((x): x is string => typeof x === "string")
			: undefined,
		...(mode ? { permissions: { mode } } : {}),
	};
}

function stringListFromCompanionField(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const list = value.filter((x): x is string => typeof x === "string");
	return list.length > 0 ? list : undefined;
}

function rpgAttributesFromFrontmatter(attrs: Record<string, number> | undefined): Record<string, number> | undefined {
	if (!attrs) return undefined;
	const nums: Record<string, number> = {};
	for (const k of ["str", "int", "wis", "cha", "dex", "con"] as const) {
		if (typeof attrs[k] === "number") nums[k] = attrs[k];
	}
	return Object.keys(nums).length > 0 ? nums : undefined;
}

async function loadAgentBlueprintForEdit(adapter: VaultFileAdapter, displayName: string): Promise<AgentBlueprint | null> {
	const { md, json } = agentVaultPaths(displayName);
	let mdText: string;
	try {
		mdText = await adapter.read(md);
	} catch {
		return null;
	}
	const fm = parseFrontmatter(mdText);
	let companion: Record<string, unknown> = {};
	try {
		companion = parseCompanionJsonRecord(await adapter.read(json));
	} catch {
		/* no companion file */
	}
	const attrs = fm.attributes as Record<string, number> | undefined;
	const rawTasks = Array.isArray(fm.suggestedTasks) ? (fm.suggestedTasks as string[]) : undefined;
	const desc = bodyAfterAgentFrontmatter(mdText);
	return {
		agentType: typeof fm.agentType === "string" ? fm.agentType : "ai",
		domain: typeof fm.domain === "string" ? fm.domain : undefined,
		persona: typeof fm.persona === "string" ? fm.persona : undefined,
		mood: typeof fm.mood === "string" ? fm.mood : undefined,
		attributes: rpgAttributesFromFrontmatter(attrs),
		suggestedTasks: rawTasks,
		description: desc || undefined,
		ai: blueprintAiFromCompanion(companion.ai),
		cursorRuleGlobs: stringListFromCompanionField(companion.cursorRuleGlobs),
	};
}

/** Load AgentCard[] from vault agent definition .md files. */
async function loadAgentCards(adapter: VaultFileAdapter, agentsDir: string): Promise<AgentCard[]> {
	const listing = await adapter.list(agentsDir);
	const mdFiles = listing.files.filter((f) => f.endsWith(".md") && !f.endsWith(".prompt.md"));

	const cards: AgentCard[] = [];
	for (const filePath of mdFiles) {
		try {
			const content = await adapter.read(filePath);
			const fm = parseFrontmatter(content);
			if (fm.type !== "Agent") continue;
			const attrs = fm.attributes as Record<string, number> | undefined;
			const persona = typeof fm.persona === "string" ? fm.persona : undefined;
			const suggestedTasks = Array.isArray(fm.suggestedTasks)
				? (fm.suggestedTasks as string[]).map(parseSuggestedTask)
				: undefined;
			const jsonPath = filePath.replace(/\.md$/i, ".json");
			let provider: string | undefined;
			try {
				const jt = await adapter.read(jsonPath);
				const j = JSON.parse(jt) as { ai?: { provider?: string } };
				if (typeof j.ai?.provider === "string") provider = j.ai.provider;
			} catch {
				/* no sidecar */
			}
			cards.push({
				name: String(fm.name ?? ""),
				persona,
				mood: typeof fm.mood === "string" ? fm.mood : undefined,
				intStat: attrs?.int,
				chaStat: attrs?.cha,
				provider,
				activity: "idle",
				suggestedTasks,
			});
		} catch {
			// Skip unreadable files
		}
	}
	return cards.sort((a, b) => a.name.localeCompare(b.name));
}

export function mountAgentSidepanel(container: HTMLElement, deps: AgentHandlerDeps): () => void {
	const { cliExecutor, eventBus, contextProvider, worldContext, vaultAdapter, agentsDir, app, getSettings } = deps;
	const el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
	const unsubscribes: (() => void)[] = [];

	let activeAgent = "";
	let activeMode: ConversationMode = "conversational";
	let teamMode = false;
	let lastContextHash = "";

	/** Local conversation log keyed by agent name. */
	const conversations = new Map<string, LocalTurn[]>();
	/** Team-wide conversation (interleaved). */
	const teamConversation: LocalTurn[] = [];

	/** Active agent process handles keyed by agent name. */
	const agentProcesses = new Map<string, AgentProcess>();
	/** Unsub functions for agent process event listeners. */
	const processUnsubs = new Map<string, () => void>();

	function getConversation(agent: string): LocalTurn[] {
		return conversations.get(agent) ?? [];
	}

	function addTurn(agent: string, role: "user" | "assistant", text: string): void {
		if (!conversations.has(agent)) conversations.set(agent, []);
		const turn: LocalTurn = {
			role,
			text,
			agent,
			mode: activeMode,
			timestamp: new Date().toISOString(),
		};
		conversations.get(agent)!.push(turn);
		if (teamMode) teamConversation.push(turn);
	}

	/** Cached agent cards — loaded once from vault, reused on refresh. */
	let cachedAgents: AgentCard[] | null = null;

	function applyAgents(agents: AgentCard[]): void {
		el.agents = agents;
		if (!activeAgent && agents.length > 0) activeAgent = agents[0].name;
		if (activeAgent && agents.length > 0 && !agents.some((a) => a.name === activeAgent)) {
			activeAgent = agents[0].name;
		}
		el.activeAgent = activeAgent;
		el.activeMode = activeMode;
		el.teamMode = teamMode;
		el.turns = teamMode
			? [...teamConversation]
			: [...getConversation(activeAgent)];
	}

	function getManagePanel(): FlowtiAgentManage | null {
		return el.shadowRoot?.querySelector("flowti-agent-manage") as FlowtiAgentManage | null;
	}

	function setManageStatus(msg: string): void {
		const manage = getManagePanel();
		if (manage) manage.statusMessage = msg;
	}

	function invalidateAgentCacheAndReload(): void {
		cachedAgents = null;
		refresh();
	}

	function refresh(): void {
		if (cachedAgents !== null) {
			applyAgents(cachedAgents);
			return;
		}
		if (vaultAdapter && agentsDir) {
			void loadAgentCards(vaultAdapter, agentsDir).then((agents) => {
				cachedAgents = agents;
				applyAgents(agents);
			});
		} else {
			applyAgents([]);
		}
	}

	/** Get or create an AgentProcess for the given agent and wire events. */
	function ensureAgentProcess(agentName: string): AgentProcess | null {
		if (!cliExecutor) return null;
		const existing = agentProcesses.get(agentName);
		if (existing?.running) return existing;

		// Clean up old subscription
		const oldUnsub = processUnsubs.get(agentName);
		if (oldUnsub) oldUnsub();

		const proc = cliExecutor.startAgent(agentName);
		agentProcesses.set(agentName, proc);

		const unsub = proc.onEvent((event: CliEvent) => {
			if (event.type === "response") {
				addTurn(agentName, "assistant", extractAgentMessage(event.text ?? ""));
				el.processing = false;
				refresh();
			}
			if (event.type === "thinking") {
				void eventBus.emit("agent.thinking", { agent: event.agent, text: event.text ?? "" });
			}
			if (event.type === "using-tool") {
				void eventBus.emit("agent.tool.started", { agent: event.agent, tool: event.tool ?? "", id: event.id ?? "" });
			}
			if (event.type === "tool-complete") {
				void eventBus.emit("agent.tool.completed", { agent: event.agent, id: event.id ?? "" });
			}
			if (event.type === "error") {
				el.error = event.text ?? "Agent error";
				el.processing = false;
				setTimeout(() => { el.error = ""; }, 5000);
			}
		});
		processUnsubs.set(agentName, unsub);
		unsubscribes.push(unsub);

		return proc;
	}

	// ── Agent selection ──
	el.addEventListener("agent-selected", ((e: CustomEvent) => {
		activeAgent = String(e.detail.agent);
		refresh();
	}) as EventListener);

	// ── Send message (with context) ──
	el.addEventListener("agent-send", ((e: CustomEvent) => {
		const message = String(e.detail.message);
		if (!activeAgent || !message) return;
		el.processing = true;
		void eventBus.emit("agent.message.sent", { agent: activeAgent, message, mode: activeMode });

		addTurn(activeAgent, "user", message);

		let enrichedMessage = message;
		if (worldContext) {
			const isFirst = !getConversation(activeAgent).length;
			let contextBlock: string;
			if (isFirst) {
				const card = cachedAgents?.find((a) => a.name === activeAgent);
				const domain = "general";
				contextBlock = worldContext.getProtocolInstruction(activeAgent, domain, card ? {
					persona: card.persona,
					mood: card.mood,
				} : undefined)
					+ "\n\n" + worldContext.serialize();
			} else {
				contextBlock = worldContext.serializeDelta(activeAgent) ?? "";
			}
			worldContext.markSeen(activeAgent);
			if (contextBlock) {
				enrichedMessage = contextBlock + "\n\n" + message;
			}
		} else if (contextProvider) {
			// Legacy fallback
			const diff = contextProvider.getDiff(lastContextHash);
			if (diff) {
				const absPath = deps.vaultBasePath ? `${deps.vaultBasePath}/${diff.path}` : diff.path;
			enrichedMessage = `[Context: ${absPath} changed]\n${diff.diff}\n\n${message}`;
				lastContextHash = diff.currentHash;
			}
			const ctx = contextProvider.getActiveFileContext();
			if (ctx) lastContextHash = ctx.contentHash;
		}

		const proc = ensureAgentProcess(activeAgent);
		if (proc) {
			proc.send(enrichedMessage);
		} else {
			el.processing = false;
			el.error = "No CLI executor available";
			setTimeout(() => { el.error = ""; }, 5000);
		}

		refresh();
	}) as EventListener);

	// ── Mode switch ──
	el.addEventListener("mode-changed", ((e: CustomEvent) => {
		activeMode = e.detail.mode as ConversationMode;
		void eventBus.emit("agent.mode.switched", { mode: activeMode });
		refresh();
	}) as EventListener);

	// ── Team toggle ──
	el.addEventListener("team-toggled", ((e: CustomEvent) => {
		teamMode = Boolean(e.detail.enabled);
		void eventBus.emit("agent.team.toggled", { enabled: teamMode });
		refresh();
	}) as EventListener);

	// ── Stop generation ──
	el.addEventListener("agent-stop", (() => {
		if (!activeAgent) return;
		const proc = agentProcesses.get(activeAgent);
		if (proc?.running) proc.stopGeneration();
		el.processing = false;
		refresh();
	}) as EventListener);

	// ── Canvas events ──
	el.addEventListener("canvas-node-added", ((e: CustomEvent) => {
		void eventBus.emit("agent.canvas.synced", {
			canvasPath: String(e.detail.canvasPath ?? ""),
			nodeCount: Number(e.detail.nodeCount ?? 0),
		});
	}) as EventListener);

	// ── Agent definition CRUD (vault + dashboard sync + Cursor rules) ──
	el.addEventListener("agent-definition-request-edit", ((e: CustomEvent) => {
		const displayName = String(e.detail?.displayName ?? "");
		if (!vaultAdapter || !displayName) return;
		void loadAgentBlueprintForEdit(vaultAdapter, displayName).then((bp) => {
			const manage = getManagePanel();
			if (bp && manage) manage.loadForEdit(displayName, bp);
		});
	}) as EventListener);

	el.addEventListener("agent-definition-save", ((e: CustomEvent) => {
		const previousName = typeof e.detail?.previousName === "string" ? e.detail.previousName : undefined;
		const displayName = String(e.detail?.displayName ?? "");
		const blueprint = e.detail?.blueprint as AgentBlueprint | undefined;
		if (!displayName || !blueprint) {
			setManageStatus("Error: invalid save payload.");
			return;
		}
		if (!deps.vaultBasePath) {
			setManageStatus("Error: vault path unavailable.");
			return;
		}
		void saveAgentDefinition(
			app,
			deps.vaultBasePath,
			displayName,
			blueprint,
			getSettings,
			undefined,
			previousName ? { previousDisplayName: previousName } : undefined,
		).then((res) => {
			setManageStatus(res.ok ? "Saved." : `Error: ${res.error ?? "save failed"}`);
			if (res.ok) invalidateAgentCacheAndReload();
		});
	}) as EventListener);

	el.addEventListener("agent-definition-delete", ((e: CustomEvent) => {
		const displayName = String(e.detail?.displayName ?? "");
		if (!displayName || !deps.vaultBasePath) return;
		void deleteAgentDefinition(app, deps.vaultBasePath, displayName, getSettings).then((res) => {
			setManageStatus(res.ok ? "Deleted." : `Error: ${res.error ?? "delete failed"}`);
			if (res.ok) {
				invalidateAgentCacheAndReload();
				getManagePanel()?.resetForNew();
			}
		});
	}) as EventListener);

	// ── Context tracking ──
	if (contextProvider) {
		const unsubCtx = contextProvider.onFileChanged((ctx) => {
			lastContextHash = ctx.contentHash;
		});
		unsubscribes.push(unsubCtx);
	}

	// ── Keyboard shortcuts ──
	const keyHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape" && el.processing) {
			const proc = agentProcesses.get(activeAgent);
			if (proc?.running) proc.stopGeneration();
			el.processing = false;
			refresh();
		}
	};
	container.addEventListener("keydown", keyHandler);
	unsubscribes.push(() => container.removeEventListener("keydown", keyHandler));

	refresh();
	container.appendChild(el);

	return () => {
		for (const unsub of unsubscribes) unsub();
		// Kill agent processes owned by this panel
		for (const proc of agentProcesses.values()) {
			if (proc.running) proc.kill();
		}
		agentProcesses.clear();
		processUnsubs.clear();
		el.remove();
	};
}
