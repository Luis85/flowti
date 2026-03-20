/**
 * Agent sidepanel handler — bridges Lit component ↔ EventBus ↔ ICliExecutor.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IEventBus } from "../events/types.js";
import type { ICliExecutor, AgentProcess, CliEvent } from "../agents/cli-executor.js";
import type { IContextProvider } from "../../domain/agents/context-provider.js";
import type { WorldContext } from "../../domain/agents/world-context.js";
import type { AgentCard, ConversationMode } from "../../domain/agents/types.js";
import { extractAgentMessage } from "../../game/data/message-utils.js";
import type { VaultFileAdapter } from "../vault-adapter.js";

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
}

/** Parse YAML frontmatter from a markdown string. Returns key-value pairs. */
function parseFrontmatter(md: string): Record<string, unknown> {
	const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return {};
	const result: Record<string, unknown> = {};
	let currentKey = "";
	let currentList: string[] | null = null;
	const indent2: Record<string, Record<string, unknown>> = {};
	let indent2Key = "";

	for (const line of match[1].split(/\r?\n/)) {
		// Nested key (2-space indent): e.g. "  str: 12"
		const nestedMatch = line.match(/^ {2}(\w+):\s*(.+)$/);
		if (nestedMatch && indent2Key) {
			if (!indent2[indent2Key]) indent2[indent2Key] = {};
			const val = nestedMatch[2].trim();
			indent2[indent2Key][nestedMatch[1]] = /^\d+$/.test(val) ? Number(val) : val;
			continue;
		}

		// List item: "  - value"
		const listMatch = line.match(/^\s+-\s+(.+)$/);
		if (listMatch && currentList) {
			currentList.push(listMatch[1]);
			continue;
		}

		// Flush previous list
		if (currentList) {
			result[currentKey] = currentList;
			currentList = null;
		}

		// Top-level key
		const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
		if (kvMatch) {
			currentKey = kvMatch[1];
			const val = kvMatch[2].trim();
			if (val === "") {
				// Could be a list or nested object — peek ahead
				currentList = [];
				indent2Key = currentKey;
			} else {
				const cleaned = val.replace(/^["']|["']$/g, "").replace(/^\[\[|\]\]$/g, "");
				result[currentKey] = /^\d+$/.test(cleaned) ? Number(cleaned) : cleaned;
				indent2Key = "";
			}
		}
	}
	if (currentList) result[currentKey] = currentList;
	for (const [k, v] of Object.entries(indent2)) {
		if (Object.keys(v).length > 0) result[k] = v;
	}
	return result;
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
			cards.push({
				name: String(fm.name ?? ""),
				persona,
				mood: typeof fm.mood === "string" ? fm.mood : undefined,
				intStat: attrs?.int,
				chaStat: attrs?.cha,
				activity: "idle",
				suggestedTasks,
			});
		} catch {
			// Skip unreadable files
		}
	}
	return cards.sort((a, b) => a.name.localeCompare(b.name));
}

/** Parse a pipe-delimited suggestedTask string into a structured object. */
export function parseSuggestedTask(raw: string): { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } } {
	const segments = raw.split("|");
	const name = segments[0].trim();
	const phases = segments.length > 1
		? segments[1].split(",").map((s) => s.trim()).filter(Boolean)
		: [];

	let input: { type: "text"; prompt: string } | undefined;
	let tool: { command: string } | undefined;

	for (let i = 2; i < segments.length; i++) {
		const seg = segments[i].trim();
		if (seg.startsWith("input:")) {
			const rest = seg.slice(6);
			const colonIdx = rest.indexOf(":");
			if (colonIdx !== -1) {
				input = { type: "text", prompt: rest.slice(colonIdx + 1) };
			}
		} else if (seg.startsWith("tool:")) {
			tool = { command: seg.slice(5) };
		}
	}

	return { name, phases, ...(input && { input }), ...(tool && { tool }) };
}

export function mountAgentSidepanel(container: HTMLElement, deps: AgentHandlerDeps): () => void {
	const { cliExecutor, eventBus, contextProvider, worldContext, vaultAdapter, agentsDir } = deps;
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
		el.activeAgent = activeAgent;
		el.activeMode = activeMode;
		el.teamMode = teamMode;
		el.turns = teamMode
			? [...teamConversation]
			: [...getConversation(activeAgent)];
	}

	function refresh(): void {
		if (cachedAgents) {
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
