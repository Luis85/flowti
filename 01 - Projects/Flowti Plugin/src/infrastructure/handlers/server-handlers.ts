/**
 * Server panel handler — bridges Lit component ↔ HttpServerService + SSE.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { HttpServerService } from "../server/http-server-service.js";
import type { ActivityEntry, ServerConfig } from "../../domain/server/types.js";
import type { SseClient } from "../agents/sse-client.js";

// Side-effect import: register the Lit custom element
import "../../components/server/flowti-server-panel.js";

export interface ServerHandlerDeps {
	readonly serverService: HttpServerService;
	readonly sseClient: SseClient;
	readonly startServer?: (onOutput?: (line: string) => void) => Promise<{ ok: boolean }>;
	readonly stopServer?: () => void;
	readonly openInBrowser?: (url: string) => void;
	readonly getServerStatus?: () => { running: boolean; entry: { pid: number; url: string; startedAt: string } | null };
}

export function mountServerPanel(container: HTMLElement, deps: ServerHandlerDeps): () => void {
	const { serverService, sseClient } = deps;
	const el = document.createElement("flowti-server-panel") as HTMLElement & Record<string, unknown>;
	const cleanups: (() => void)[] = [];

	const entries: ActivityEntry[] = [];
	let entryCounter = 0;

	// ── Refresh server status ──
	async function refreshStatus(): Promise<void> {
		if (deps.getServerStatus) {
			const status = deps.getServerStatus();
			el.running = status.running;
			if (status.entry) {
				el.pid = status.entry.pid;
				el.url = status.entry.url;
				const startedAt = new Date(status.entry.startedAt).getTime();
				el.uptime = Math.floor((Date.now() - startedAt) / 1000);
			} else {
				el.pid = 0;
				el.url = "";
				el.uptime = 0;
			}
		}
		el.port = 3000;
	}

	// ── Stats polling ──
	let statsInterval: ReturnType<typeof setInterval> | null = null;
	async function refreshStats(): Promise<void> {
		const stats = await serverService.getStats();
		el.stats = stats;
	}

	statsInterval = setInterval(() => void refreshStats(), 5000);
	cleanups.push(() => { if (statsInterval) clearInterval(statsInterval); });

	// ── Load config ──
	async function loadConfig(): Promise<void> {
		const config = await serverService.getConfig();
		el.config = config;
	}

	// ── SSE activity listener ──
	const unsubSse = sseClient.on("agent-action", (data) => {
		const entry: ActivityEntry = {
			id: `entry-${++entryCounter}`,
			timestamp: new Date().toISOString(),
			agentName: String(data.agentName ?? ""),
			actionType: String(data.type ?? ""),
			text: String((data.data as Record<string, unknown>)?.text ?? data.text ?? ""),
			expanded: false,
		};
		entries.push(entry);
		if (entries.length > 200) entries.shift();
		el.entries = [...entries];
	});
	cleanups.push(unsubSse);

	// ── Process output buffer ──
	const outputLines: string[] = [];

	function appendOutput(line: string): void {
		outputLines.push(line);
		if (outputLines.length > 200) outputLines.shift();
		el.outputLines = [...outputLines];
	}

	function clearOutput(): void {
		outputLines.length = 0;
		el.outputLines = [];
		el.outputBusy = false;
		el.outputError = "";
	}

	// ── Server lifecycle events ──
	el.addEventListener("server-start", (() => {
		if (deps.startServer) {
			clearOutput();
			el.outputBusy = true;
			el.outputBusyLabel = "Starting server...";
			void deps.startServer(appendOutput).then((result) => {
				el.outputBusy = false;
				if (!result.ok) el.outputError = "Server failed to start";
				void refreshStatus();
			});
		}
	}) as EventListener);

	el.addEventListener("server-stop", (() => {
		deps.stopServer?.();
		appendOutput("[Server stopped]");
		void refreshStatus();
	}) as EventListener);

	el.addEventListener("server-restart", (() => {
		clearOutput();
		el.outputBusy = true;
		el.outputBusyLabel = "Restarting server...";
		appendOutput("[Stopping server...]");
		deps.stopServer?.();
		setTimeout(() => {
			if (deps.startServer) {
				appendOutput("[Starting server...]");
				void deps.startServer(appendOutput).then((result) => {
					el.outputBusy = false;
					if (!result.ok) el.outputError = "Server failed to restart";
					void refreshStatus();
				});
			}
		}, 1000);
	}) as EventListener);

	el.addEventListener("server-visit", (() => {
		const url = String(el.url || "http://localhost:3000");
		deps.openInBrowser?.(url);
	}) as EventListener);

	// ── Config events ──
	el.addEventListener("config-apply", ((e: CustomEvent) => {
		const config = e.detail as Partial<ServerConfig>;
		void serverService.updateConfig(config).then(() => {
			void serverService.restart();
		});
	}) as EventListener);

	// ── Feed events ──
	el.addEventListener("feed-pause", (() => { el.paused = true; }) as EventListener);
	el.addEventListener("feed-resume", (() => { el.paused = false; }) as EventListener);
	el.addEventListener("feed-clear", (() => {
		entries.length = 0;
		el.entries = [];
	}) as EventListener);

	// ── Initial load ──
	container.appendChild(el);
	void refreshStatus();
	void refreshStats();
	void loadConfig();

	return () => {
		for (const fn of cleanups) fn();
		el.remove();
	};
}
