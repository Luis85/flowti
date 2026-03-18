/**
 * Agent domain events for the sidepanel view.
 */

import type { ConversationTurn, ConversationMode } from "./types";

export interface AgentEventMap {
	"agent.status.changed": { agent: string; activity: string };
	"agent.message.received": { agent: string; turn: ConversationTurn };
	"agent.message.sent": { agent: string; turn: ConversationTurn };
	"agent.thinking": { agent: string; text: string };
	"agent.tool.started": { agent: string; tool: string; id: string };
	"agent.tool.completed": { agent: string; id: string };
	"agent.mode.switched": { mode: ConversationMode };
	"agent.team.toggled": { enabled: boolean };
	"agent.canvas.synced": { canvasPath: string; nodeCount: number };
}
