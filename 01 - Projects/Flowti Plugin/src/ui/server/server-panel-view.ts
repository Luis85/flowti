/**
 * Obsidian ItemView shell for the Server Management Panel.
 */

import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { HttpServerService } from "../../infrastructure/server/http-server-service.js";
import type { SseClient } from "../../infrastructure/agents/sse-client.js";
import { VIEW_TYPE_SERVER_PANEL } from "./types.js";

export interface ServerPanelDeps {
	readonly serverService: HttpServerService;
	readonly sseClient: SseClient;
	readonly startServer?: (onOutput?: (line: string) => void) => Promise<{ ok: boolean }>;
	readonly stopServer?: () => void;
	readonly openInBrowser?: (url: string) => void;
	readonly getServerStatus?: () => { running: boolean; entry: { pid: number; url: string; startedAt: string } | null };
}

export class ServerPanelView extends ItemView {
	private deps: ServerPanelDeps;
	private dispose: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, deps: ServerPanelDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return VIEW_TYPE_SERVER_PANEL;
	}

	getDisplayText(): string {
		return "Server panel";
	}

	getIcon(): string {
		return "activity";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("ft-server-panel");
		this.contentEl.empty();

		const { mountServerPanel } = await import("../../infrastructure/handlers/server-handlers.js");
		this.dispose = mountServerPanel(this.contentEl, this.deps);
	}

	async onClose(): Promise<void> {
		if (this.dispose) {
			this.dispose();
			this.dispose = null;
		}
	}
}
