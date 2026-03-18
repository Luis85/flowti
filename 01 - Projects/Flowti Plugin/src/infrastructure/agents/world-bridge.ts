/**
 * WorldBridge — hybrid data layer for the embedded Agent World game.
 *
 * Merges vault state, Plugin EventBus events, and SSE from the CLI server
 * into a unified callback feed consumed by the game's BridgeProvider.
 *
 * Exposed on `window.__flowtiWorldBridge` by the AgentWorldView.
 */

import type { IEventBus, EventType, FlowtiEvent } from "../events/types.js";
import { SseClient } from "./sse-client.js";

/** Events relayed from EventBus to the game. */
const RELAYED_EVENTS: EventType[] = [
	"agent.status.changed",
	"agent.message.received",
	"agent.message.sent",
];

type ActionCallback = (event: { type: string; payload: unknown }) => void;
type EntityCallback = (event: { type: string; payload: unknown }) => void;

interface BufferedEvent {
	type: string;
	payload: unknown;
}

const MAX_BUFFER = 50;

export interface WorldBridgeConfig {
	containerElement: HTMLElement;
	eventBus: IEventBus;
	vaultBasePath: string;
	baseUrl: string;
	initialWorldState: unknown | null;
}

export class WorldBridge {
	readonly containerElement: HTMLElement;
	readonly assetBasePath: string;
	serverOnline = false;

	private readonly eventBus: IEventBus;
	private readonly baseUrl: string;
	private readonly initialState: unknown | null;
	private readonly sseClient: SseClient;

	private actionCallbacks = new Set<ActionCallback>();
	private entityCallbacks = new Set<EntityCallback>();

	private eventBusUnsubs: Array<() => void> = [];
	private sseUnsubs: Array<() => void> = [];

	private paused = false;
	private buffer: BufferedEvent[] = [];

	constructor(config: WorldBridgeConfig) {
		this.containerElement = config.containerElement;
		this.eventBus = config.eventBus;
		this.baseUrl = config.baseUrl;
		this.initialState = config.initialWorldState;

		// Construct asset path with forward slashes
		const normalized = config.vaultBasePath.replace(/\\/g, "/");
		this.assetBasePath = `file:///${normalized}/.flowti/agents/`;

		this.sseClient = new SseClient(`${config.baseUrl}/events`);

		this.subscribeEventBus();
	}

	async getWorldState(): Promise<unknown | null> {
		return this.initialState;
	}

	onAction(cb: ActionCallback): () => void {
		this.actionCallbacks.add(cb);
		return () => { this.actionCallbacks.delete(cb); };
	}

	onEntityUpdate(cb: EntityCallback): () => void {
		this.entityCallbacks.add(cb);
		return () => { this.entityCallbacks.delete(cb); };
	}

	async sendCommand(endpoint: string, body: Record<string, unknown>): Promise<void> {
		if (this.serverOnline) {
			await fetch(`${this.baseUrl}${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
		} else {
			await this.eventBus.emitCustom(`world.command`, { endpoint, body });
		}
	}

	async connectServer(): Promise<void> {
		try {
			const response = await fetch(`${this.baseUrl}/api/health`);
			if (response.ok) {
				this.serverOnline = true;
				this.sseClient.connect();
				this.subscribeSse();
				this.sseClient.onDisconnect(() => {
					this.serverOnline = false;
				});
			}
		} catch {
			this.serverOnline = false;
		}
	}

	pause(): void {
		this.paused = true;
	}

	resume(): void {
		this.paused = false;
		const pending = this.buffer.splice(0, this.buffer.length);
		for (const event of pending) {
			this.emitToCallbacks(event.type, event.payload);
		}
	}

	dispose(): void {
		for (const unsub of this.eventBusUnsubs) unsub();
		this.eventBusUnsubs = [];

		for (const unsub of this.sseUnsubs) unsub();
		this.sseUnsubs = [];

		this.sseClient.disconnect();
		this.actionCallbacks.clear();
		this.entityCallbacks.clear();
		this.buffer = [];
		this.serverOnline = false;
	}

	get hasEventBusListeners(): boolean {
		return this.eventBusUnsubs.length > 0;
	}

	// ── Private ────────────────────────────────────────────────

	private subscribeEventBus(): void {
		for (const eventType of RELAYED_EVENTS) {
			const unsub = this.eventBus.on(eventType, (event: FlowtiEvent) => {
				this.pushEvent(event.type, event.payload);
			});
			this.eventBusUnsubs.push(unsub);
		}
	}

	private subscribeSse(): void {
		const actionUnsub = this.sseClient.on("agent-action", (data) => {
			this.pushEvent("sse.agent-action", data);
		});
		const entityUnsub = this.sseClient.on("entity-update", (data) => {
			this.pushEvent("sse.entity-update", data);
		});
		this.sseUnsubs.push(actionUnsub, entityUnsub);
	}

	private pushEvent(type: string, payload: unknown): void {
		if (this.paused) {
			this.buffer.push({ type, payload });
			if (this.buffer.length > MAX_BUFFER) {
				this.buffer.shift();
			}
			return;
		}
		this.emitToCallbacks(type, payload);
	}

	private emitToCallbacks(type: string, payload: unknown): void {
		const event = { type, payload };
		for (const cb of this.actionCallbacks) cb(event);
		for (const cb of this.entityCallbacks) cb(event);
	}
}
