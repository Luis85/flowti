/**
 * Server domain bootstrap — registers server panel view + command + ribbon.
 */

import type { App, Plugin, WorkspaceLeaf } from "obsidian";
import { HttpServerService } from "../infrastructure/server/http-server-service.js";
import type { SseClient } from "../infrastructure/agents/sse-client.js";
import { ServerPanelView, type ServerPanelDeps } from "../ui/server/server-panel-view.js";
import { VIEW_TYPE_SERVER_PANEL } from "../ui/server/types.js";
import { getServerStatus, killServer, clearServerRegistry } from "../infrastructure/agents/server-launcher.js";
import type { LaunchResult } from "../infrastructure/agents/server-launcher.js";

export interface ServerSetupDeps {
	readonly plugin: Plugin;
	readonly app: App;
	readonly sseClient: SseClient;
	readonly cliServerUrl?: string;
	readonly startServer: (onOutput?: (line: string) => void) => Promise<LaunchResult>;
}

export interface ServerSetupResult {
	readonly serverService: HttpServerService;
}

export function setupServerDomain(deps: ServerSetupDeps): ServerSetupResult {
	const baseUrl = deps.cliServerUrl ?? "http://localhost:3000";
	const serverService = new HttpServerService(baseUrl);
	const vaultPath = (deps.app.vault.adapter as unknown as { basePath: string }).basePath;

	const viewDeps: ServerPanelDeps = {
		serverService,
		sseClient: deps.sseClient,
		startServer: deps.startServer,
		stopServer: () => {
			const status = getServerStatus(vaultPath);
			if (status.entry?.pid) {
				killServer(status.entry.pid);
				clearServerRegistry(vaultPath);
			}
		},
		openInBrowser: () => {
			const existing = deps.app.workspace.getLeavesOfType("flowti-agent-world");
			if (existing.length > 0) {
				void deps.app.workspace.revealLeaf(existing[0]);
			} else {
				const leaf = deps.app.workspace.getLeaf(true);
				void leaf.setViewState({ type: "flowti-agent-world", active: true });
			}
		},
		getServerStatus: () => {
			const status = getServerStatus(vaultPath);
			return {
				running: status.running,
				entry: status.entry ? { pid: status.entry.pid, url: status.entry.url, startedAt: status.entry.startedAt } : null,
			};
		},
	};

	try {
		deps.plugin.registerView(VIEW_TYPE_SERVER_PANEL, (leaf: WorkspaceLeaf) => {
			return new ServerPanelView(leaf, viewDeps);
		});
	} catch (err) {
		if (err instanceof Error && !err.message.includes("existing view type")) throw err;
	}

	deps.plugin.addCommand({
		id: "open-server-panel",
		name: "Open server panel",
		callback: () => {
			const existing = deps.app.workspace.getLeavesOfType(VIEW_TYPE_SERVER_PANEL);
			if (existing.length > 0) {
				void deps.app.workspace.revealLeaf(existing[0]);
				return;
			}
			const leaf = deps.app.workspace.getRightLeaf(false);
			if (leaf) void leaf.setViewState({ type: VIEW_TYPE_SERVER_PANEL, active: true });
		},
	});

	return { serverService };
}
