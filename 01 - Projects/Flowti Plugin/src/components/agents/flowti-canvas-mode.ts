// src/components/agents/flowti-canvas-mode.ts
import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationTurn } from "../../domain/agents/types.js";

/**
 * Canvas node in Obsidian's .canvas JSON format.
 */
export interface CanvasNode {
	readonly id: string;
	readonly type: "text";
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly text: string;
	readonly color?: string;
}

/**
 * Canvas edge in Obsidian's .canvas JSON format.
 */
export interface CanvasEdge {
	readonly id: string;
	readonly fromNode: string;
	readonly toNode: string;
	readonly fromSide: "bottom" | "top" | "left" | "right";
	readonly toSide: "bottom" | "top" | "left" | "right";
}

/**
 * Full Obsidian .canvas JSON structure.
 */
export interface CanvasData {
	readonly nodes: CanvasNode[];
	readonly edges: CanvasEdge[];
}

/** Role-to-color mapping for canvas nodes. */
const ROLE_COLORS: Record<string, string> = {
	user: "4",      // blue
	agent: "3",     // green
	tool: "5",      // purple
};

/** Layout constants. */
const NODE_WIDTH = 300;
const NODE_HEIGHT = 120;
const NODE_GAP_Y = 160;

/**
 * Canvas mode component — manages an Obsidian .canvas file that
 * visualizes conversation turns as connected nodes.
 *
 * Does NOT render a canvas itself; instead shows a preview of the
 * canvas state and fires events to request the host open the actual
 * .canvas file in Obsidian.
 *
 * Custom events:
 * - `canvas-open-requested` — { agentName, sessionId }
 * - `canvas-node-added` — { node, edge? }
 */
export class FlowtiCanvasMode extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		turns: { type: Array },
		agentName: { type: String },
		canvasPath: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: block; flex: 1; overflow-y: auto; }
			.canvas-mode {
				padding: var(--flowti-space-sm);
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}
			.canvas-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--flowti-space-sm);
			}
			.canvas-path {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.open-btn {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: none;
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				white-space: nowrap;
			}
			.open-btn:hover { opacity: 0.9; }
			.preview {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}
			.preview-node {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
				border-left: 3px solid var(--flowti-border);
			}
			.preview-node--user { border-left-color: var(--flowti-color-info); }
			.preview-node--agent { border-left-color: var(--flowti-color-success); }
			.preview-node__role {
				font-size: 0.7em;
				color: var(--flowti-color-muted);
				text-transform: uppercase;
				margin-bottom: 2px;
			}
			.preview-node__text {
				white-space: pre-wrap;
				word-wrap: break-word;
				max-height: 3.6em;
				overflow: hidden;
			}
			.export-btn {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: none;
				color: var(--text-normal);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				align-self: flex-start;
			}
			.export-btn:hover { background: var(--background-modifier-hover); }
			.node-count {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}
		`,
	];

	turns: ConversationTurn[] = [];
	agentName = "";
	canvasPath = "";

	protected renderContent() {
		return html`
			<div class="canvas-mode">
				${this.renderHeader()}
				${this.renderPreview()}
				${this.turns.length > 0 ? html`
					<div class="node-count">${this.turns.length} node${this.turns.length !== 1 ? "s" : ""}</div>
					<button class="export-btn" data-action="export" @click="${this.exportCanvas}">Export Canvas JSON</button>
				` : ""}
			</div>
		`;
	}

	private renderHeader() {
		return html`
			<div class="canvas-header">
				<span class="canvas-path">${this.canvasPath || "No canvas file"}</span>
				<button class="open-btn" data-action="open" @click="${this.requestOpen}">Open Canvas</button>
			</div>
		`;
	}

	private renderPreview() {
		if (this.turns.length === 0) {
			return html`<div class="preview"><em>Send a message to start the canvas.</em></div>`;
		}
		return html`
			<div class="preview">
				${this.turns.map((t) => html`
					<div class="preview-node preview-node--${t.role}" data-node-id="${t.id}">
						<div class="preview-node__role">${t.role === "agent" ? (t.persona ?? t.agentName ?? "Agent") : "You"}</div>
						<div class="preview-node__text">${t.content}</div>
					</div>
				`)}
			</div>
		`;
	}

	/**
	 * Build the full canvas JSON from turns.
	 */
	buildCanvasData(): CanvasData {
		const nodes: CanvasNode[] = this.turns.map((t, i) => ({
			id: t.id,
			type: "text" as const,
			x: 0,
			y: i * NODE_GAP_Y,
			width: NODE_WIDTH,
			height: NODE_HEIGHT,
			text: `**${t.role === "user" ? "You" : (t.persona ?? t.agentName ?? "Agent")}**\n\n${t.content}`,
			color: ROLE_COLORS[t.role] ?? undefined,
		}));

		const edges: CanvasEdge[] = [];
		for (let i = 1; i < this.turns.length; i++) {
			edges.push({
				id: `edge-${this.turns[i - 1].id}-${this.turns[i].id}`,
				fromNode: this.turns[i - 1].id,
				toNode: this.turns[i].id,
				fromSide: "bottom",
				toSide: "top",
			});
		}

		return { nodes, edges };
	}

	private requestOpen() {
		this.dispatchEvent(new CustomEvent("canvas-open-requested", {
			detail: { agentName: this.agentName, canvasPath: this.canvasPath },
			bubbles: true,
			composed: true,
		}));
	}

	private exportCanvas() {
		const data = this.buildCanvasData();
		this.dispatchEvent(new CustomEvent("canvas-node-added", {
			detail: { canvasData: data, canvasPath: this.canvasPath },
			bubbles: true,
			composed: true,
		}));
	}
}

customElements.define("flowti-canvas-mode", FlowtiCanvasMode);
