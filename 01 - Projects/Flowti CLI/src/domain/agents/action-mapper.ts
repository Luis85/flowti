/**
 * action-mapper.ts — Maps stream events to world-state agent actions.
 *
 * Pure function. No I/O, no side effects.
 */

import type { AgentStreamEvent } from "./agent-stream.js";
import type { AgentAction } from "./world-state-types.js";
import type { IClock } from "../../infrastructure/types.js";

export function mapStreamEventToAction(agentName: string, event: AgentStreamEvent, clock: IClock): AgentAction | null {
	const base = { id: `action-${clock.ms()}-${Math.random().toString(36).slice(2, 8)}`, agentName, timestamp: clock.iso() };
	switch (event.kind) {
		case "thinking": return { ...base, type: "thinking", data: { text: event.text } };
		case "text": return { ...base, type: "speaking", data: { text: event.text } };
		case "tool-start": return { ...base, type: "using-tool", data: { tool: event.name, id: event.id } };
		case "tool-end": return { ...base, type: "tool-complete", data: { id: event.id } };
		case "tool-input": return null;
		case "error": return { ...base, type: "error", data: { message: event.message } };
		case "done": return null;
		case "usage": return null;
		default: return null;
	}
}
