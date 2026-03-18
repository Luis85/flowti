/**
 * Obsidian ItemView shell for the embedded Agent World (ExcaliburJS game).
 *
 * Lifecycle:
 *  1. onOpen  — reads world-state, loads dashboard.js via blob URL, creates WorldBridge
 *  2. visible — engine runs, bridge relays events
 *  3. hidden  — engine paused, bridge buffers events
 *  4. onClose — full teardown (bridge, engine, blob URL, observers)
 */

import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types.js";
import { WorldBridge } from "../../infrastructure/agents/world-bridge.js";
import { VIEW_TYPE_AGENT_WORLD } from "./types.js";

/* ── Window augmentation for game globals ──────────────── */

declare global {
	interface Window {
		__flowtiWorldBridge?: WorldBridge;
		__flowtiEngine?: { stop(): void; dispose(): void; start(loader?: unknown): Promise<void> };
	}
}

/* ── Deps ──────────────────────────────────────────────── */

export interface AgentWorldViewDeps {
	readonly app: { vault: { adapter: { exists(path: string): Promise<boolean>; read(path: string): Promise<string> } } };
	readonly eventBus: IEventBus;
	readonly baseUrl: string;
}

/* ── Status helpers ────────────────────────────────────── */

type ConnectionStatus = "server" | "local" | "snapshot";

function statusColor(status: ConnectionStatus): string {
	switch (status) {
		case "server": return "#22c55e";   // green
		case "local": return "#eab308";    // yellow
		case "snapshot": return "#9ca3af"; // gray
	}
}

function statusLabel(status: ConnectionStatus): string {
	switch (status) {
		case "server": return "Server connected";
		case "local": return "Local events";
		case "snapshot": return "Snapshot only";
	}
}

/* ── View ──────────────────────────────────────────────── */

const WORLD_STATE_PATH = ".flowti/var/world-state.json";
const DASHBOARD_JS_PATH = ".flowti/agents/dashboard.js";
const STATUS_INTERVAL_MS = 5000;

export class AgentWorldView extends ItemView {
	private deps: AgentWorldViewDeps;
	private bridge: WorldBridge | null = null;
	private observer: IntersectionObserver | null = null;
	private statusInterval: ReturnType<typeof setInterval> | null = null;
	private blobUrl: string | null = null;

	constructor(leaf: WorkspaceLeaf, deps: AgentWorldViewDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return VIEW_TYPE_AGENT_WORLD;
	}

	getDisplayText(): string {
		return "Agent world";
	}

	getIcon(): string {
		return "globe";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();

		// ── Status bar ──
		const statusBar = this.contentEl.createDiv({ cls: "ft-world-status" });
		const dot = statusBar.createSpan({ cls: "ft-world-status-dot" });
		dot.style.display = "inline-block";
		dot.style.width = "8px";
		dot.style.height = "8px";
		dot.style.borderRadius = "50%";
		dot.style.backgroundColor = statusColor("snapshot");
		dot.style.marginRight = "6px";
		const label = statusBar.createSpan({ cls: "ft-world-status-label", text: "Loading..." });

		// ── Game container ──
		const container = this.contentEl.createDiv({ cls: "ft-world-container" });
		container.id = "flowti-world";
		container.tabIndex = 0;

		// ── Read world state ──
		const adapter = this.deps.app.vault.adapter;
		let worldState: unknown = null;
		try {
			const stateExists = await adapter.exists(WORLD_STATE_PATH);
			if (stateExists) {
				const raw = await adapter.read(WORLD_STATE_PATH);
				worldState = JSON.parse(raw);
			}
		} catch {
			// Missing or invalid — proceed with null
		}

		// ── Check dashboard.js ──
		const dashboardExists = await adapter.exists(DASHBOARD_JS_PATH);
		if (!dashboardExists) {
			container.empty();
			container.createDiv({
				cls: "ft-world-missing",
				text: "Agent world not built. Run `flowti build --project=\"Flowti CLI\"` to generate dashboard.js.",
			});
			label.setText("Not available");
			return;
		}

		// ── Inject Silkscreen font ──
		const fontStyle = document.createElement("style");
		fontStyle.textContent = "@import url('https://fonts.googleapis.com/css2?family=Silkscreen&display=swap');";
		this.contentEl.appendChild(fontStyle);

		// ── Create WorldBridge ──
		const vaultBasePath = (this.app.vault.adapter as { basePath?: string }).basePath ?? "";
		this.bridge = new WorldBridge({
			containerElement: container,
			eventBus: this.deps.eventBus,
			vaultBasePath,
			baseUrl: this.deps.baseUrl,
			initialWorldState: worldState,
		});
		window.__flowtiWorldBridge = this.bridge;

		// ── Connect server (silent) ──
		try {
			await this.bridge.connectServer();
		} catch {
			// Server not available — that's fine
		}

		// ── Load dashboard.js via blob URL ──
		try {
			const scriptContent = await adapter.read(DASHBOARD_JS_PATH);
			const blob = new Blob([scriptContent], { type: "application/javascript" });
			this.blobUrl = URL.createObjectURL(blob);

			const script = document.createElement("script");
			script.src = this.blobUrl;
			script.onerror = () => {
				container.createDiv({
					cls: "ft-world-error",
					text: "Failed to load agent world script.",
				});
			};
			this.contentEl.appendChild(script);
		} catch {
			container.createDiv({
				cls: "ft-world-error",
				text: "Failed to read dashboard.js.",
			});
		}

		// ── Visibility observer (pause/resume) ──
		this.observer = new IntersectionObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;

			if (entry.isIntersecting) {
				this.bridge?.resume();
				if (window.__flowtiEngine) {
					window.__flowtiEngine.start().catch(() => { /* ignore */ });
				}
			} else {
				this.bridge?.pause();
				if (window.__flowtiEngine) {
					window.__flowtiEngine.stop();
				}
			}
		});
		this.observer.observe(container);

		// ── Status polling ──
		const updateStatus = (): void => {
			let status: ConnectionStatus = "snapshot";
			if (this.bridge?.serverOnline) {
				status = "server";
			} else if (this.bridge?.hasEventBusListeners) {
				status = "local";
			}
			dot.style.backgroundColor = statusColor(status);
			label.setText(statusLabel(status));
		};

		updateStatus();
		this.statusInterval = setInterval(updateStatus, STATUS_INTERVAL_MS);
	}

	async onClose(): Promise<void> {
		// ── Stop engine ──
		if (window.__flowtiEngine) {
			try {
				window.__flowtiEngine.stop();
				window.__flowtiEngine.dispose();
			} catch {
				// Best-effort teardown
			}
			delete window.__flowtiEngine;
		}

		// ── Dispose bridge ──
		if (this.bridge) {
			this.bridge.dispose();
			this.bridge = null;
		}
		delete window.__flowtiWorldBridge;

		// ── Disconnect observer ──
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		// ── Clear status interval ──
		if (this.statusInterval !== null) {
			clearInterval(this.statusInterval);
			this.statusInterval = null;
		}

		// ── Revoke blob URLs ──
		if (this.blobUrl) {
			URL.revokeObjectURL(this.blobUrl);
			this.blobUrl = null;
		}

		// ── Empty container ──
		this.contentEl.empty();
	}
}
