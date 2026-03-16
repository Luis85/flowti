import type { AgentAction, WorldState } from "./types.js";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export function parseSSEMessage(raw: string): { event: string; data: string } | null {
	if (!raw.trim()) return null;

	const lines = raw.split("\n");
	let event = "";
	const dataLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith(":")) continue;
		if (line.startsWith("event: ")) {
			event = line.slice(7).trim();
		} else if (line.startsWith("data: ")) {
			dataLines.push(line.slice(6));
		}
	}

	if (dataLines.length === 0) return null;
	return { event: event || "message", data: dataLines.join("\n") };
}

export function parseAgentAction(json: string): AgentAction | null {
	try {
		if (!json) return null;
		return JSON.parse(json) as AgentAction;
	} catch {
		return null;
	}
}

const MAX_BACKOFF_MS = 30_000;

export function createEventStream(
	url: string,
	onAction: (action: AgentAction) => void,
	onEntityUpdate: (state: WorldState) => void,
	onStatusChange: (status: ConnectionStatus) => void,
): { close: () => void } {
	let attempt = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let source: EventSource | null = null;
	let closed = false;

	function connect(): void {
		if (closed) return;

		source = new EventSource(url);

		source.onopen = () => {
			attempt = 0;
			onStatusChange("connected");
		};

		source.addEventListener("agent-action", (e: MessageEvent) => {
			const action = parseAgentAction(e.data as string);
			if (action) onAction(action);
		});

		source.addEventListener("world-state", (e: MessageEvent) => {
			try {
				const state = JSON.parse(e.data as string) as WorldState;
				onEntityUpdate(state);
			} catch {
				/* ignore malformed state updates */
			}
		});

		source.onerror = () => {
			source?.close();
			if (closed) return;
			onStatusChange("reconnecting");
			const delay = Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
			attempt++;
			reconnectTimer = setTimeout(connect, delay);
		};
	}

	connect();

	return {
		close() {
			closed = true;
			source?.close();
			if (reconnectTimer !== null) clearTimeout(reconnectTimer);
		},
	};
}
