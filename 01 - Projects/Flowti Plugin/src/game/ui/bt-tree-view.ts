/**
 * Collapsible behavior-tree node visualization with live status colors.
 * Renders a BTTreeSnapshot as a vertical indented tree.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./game-styles.js";
import type { BTTreeSnapshot, BTNodeState, BTNodeType, BTNodeStatus } from "../store/dashboard-store.js";

// ── Constants ────────────────────────────────────────────────────────

const TYPE_ICONS: Record<BTNodeType, string> = {
	selector: "?",
	sequence: "\u2192",
	condition: "\u25C6",
	action: "\u25B6",
};

const STATUS_COLORS: Record<Exclude<BTNodeStatus, "idle">, string> = {
	running: "var(--accent-blue)",
	success: "var(--accent-green)",
	failure: "var(--text-muted)",
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Returns true if this node or any descendant has status "running". */
function hasRunningDescendant(node: BTNodeState): boolean {
	if (node.status === "running") return true;
	return node.children.some(hasRunningDescendant);
}

// ── Component ────────────────────────────────────────────────────────

export class BtTreeView extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		snapshot: { attribute: false },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		css`
			:host { display: block; }

			.tree-container {
				max-height: 300px;
				overflow-y: auto;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			.node {
				display: flex;
				align-items: center;
				gap: 4px;
				padding: 2px 0;
				padding-left: calc(var(--depth, 0) * 16px);
				font-size: 11px;
				cursor: default;
			}

			.toggle {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 14px;
				font-size: 9px;
				color: var(--text-muted);
				cursor: pointer;
				user-select: none;
				flex-shrink: 0;
			}

			.icon {
				color: var(--accent-gold);
				font-size: 10px;
				flex-shrink: 0;
				width: 12px;
				text-align: center;
			}

			.label {
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				flex: 1;
			}

			.dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.empty-msg {
				color: var(--text-muted);
				font-style: italic;
				font-size: 11px;
			}
		`,
	];

	snapshot?: BTTreeSnapshot;

	collapsed: Set<string> = new Set();

	protected renderContent() {
		if (!this.snapshot) {
			return html`<div class="empty-msg">No BT data</div>`;
		}

		// Auto-expand active path before rendering
		this.autoExpandRunning(this.snapshot.root);

		return html`
			<div class="tree-container">
				${this.renderNode(this.snapshot.root, 0)}
			</div>
		`;
	}

	private renderNode(node: BTNodeState, depth: number): unknown {
		const hasChildren = node.children.length > 0;
		const isCollapsed = this.collapsed.has(node.id);
		return html`
			<div class="node" style="--depth:${depth}">
				${hasChildren ? html`<span class="toggle" @click=${() => this.toggleNode(node.id)}>${isCollapsed ? "\u25B6" : "\u25BC"}</span>` : html`<span class="toggle"></span>`}
				<span class="icon">${TYPE_ICONS[node.type]}</span>
				<span class="label" title="${node.label}">${node.label}</span>
				${node.status !== "idle" ? html`<span class="dot" style="background:${STATUS_COLORS[node.status]}"></span>` : nothing}
			</div>
			${hasChildren && !isCollapsed ? html`<div class="children">${node.children.map(c => this.renderNode(c, depth + 1))}</div>` : nothing}
		`;
	}

	private toggleNode(id: string): void {
		if (this.collapsed.has(id)) {
			this.collapsed.delete(id);
		} else {
			this.collapsed.add(id);
		}
		this.requestUpdate();
	}

	/** Auto-expand nodes along any active (running) path. */
	private autoExpandRunning(node: BTNodeState): void {
		if (hasRunningDescendant(node)) {
			this.collapsed.delete(node.id);
		}
		for (const child of node.children) {
			this.autoExpandRunning(child);
		}
	}
}

if (!customElements.get("ft-game-bt-tree-view")) customElements.define("ft-game-bt-tree-view", BtTreeView);
