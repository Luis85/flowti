/**
 * Reporting tab for the project detail view.
 * Renders report generators as a DAG pipeline using CSS Grid,
 * with topological sorting, node state badges, and run controls.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { ReportGeneratorInfo } from "../../domain/projects/types.js";

export class FlowtiTabReporting extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		generators: { type: Array },
		nodeStates: { type: Object },
		expandedNode: { type: String },
		outputLines: { type: Array },
		busy: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md, 16px);
			}

			.controls {
				display: flex;
				justify-content: flex-end;
				padding-bottom: var(--flowti-space-sm, 8px);
				border-bottom: 1px solid var(--background-modifier-border, #333);
			}

			.run-all-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-lg, 24px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--interactive-accent, #7c3aed);
				background: var(--interactive-accent, #7c3aed);
				color: var(--text-on-accent, #fff);
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				cursor: pointer;
			}

			.run-all-btn:hover:not(:disabled) {
				opacity: 0.9;
			}

			.run-all-btn:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.dag-container {
				display: grid;
				gap: var(--flowti-space-lg, 24px);
				align-items: start;
				position: relative;
				overflow-x: auto;
				padding: var(--flowti-space-sm, 8px) 0;
			}

			.dag-layer {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm, 8px);
				min-width: 160px;
			}

			.dag-layer-label {
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-faint, #666);
				text-align: center;
				padding-bottom: var(--flowti-space-xs, 4px);
			}

			.node-card {
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				background: var(--background-primary, #1e1e1e);
				cursor: pointer;
				transition: border-color 0.15s ease;
			}

			.node-card:hover {
				border-color: var(--interactive-accent, #7c3aed);
			}

			.node-card--expanded {
				border-color: var(--interactive-accent, #7c3aed);
			}

			.node-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
			}

			.node-badge {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.node-badge--not-run {
				background: var(--text-faint, #666);
			}

			.node-badge--running {
				background: var(--color-blue, #2196f3);
				animation: pulse 1s infinite;
			}

			.node-badge--passed {
				background: var(--color-green, #4caf50);
			}

			.node-badge--failed {
				background: var(--color-red, #e53935);
			}

			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.4; }
			}

			.node-label {
				flex: 1;
				font-size: var(--flowti-font-sm, 0.85em);
				color: var(--text-normal, #ddd);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.node-run-btn {
				padding: 2px 10px;
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
				flex-shrink: 0;
			}

			.node-run-btn:hover:not(:disabled) {
				background: var(--background-modifier-hover, #333);
				border-color: var(--interactive-accent, #7c3aed);
				color: var(--interactive-accent, #7c3aed);
			}

			.node-run-btn:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.node-output {
				margin-top: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px);
				background: var(--background-secondary, #272727);
				border-radius: var(--flowti-radius-sm, 4px);
				font-family: var(--font-monospace);
				font-size: 0.78em;
				color: var(--text-muted, #999);
				max-height: 150px;
				overflow-y: auto;
				white-space: pre-wrap;
				word-break: break-all;
			}

			.empty-message {
				padding: var(--flowti-space-xl, 32px);
				text-align: center;
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
			}
		`,
	];

	projectName = "";
	generators: ReportGeneratorInfo[] = [];
	nodeStates: Record<string, string> = {};
	expandedNode: string | null = null;
	outputLines: string[] = [];
	busy = false;

	protected renderContent() {
		if (this.generators.length === 0) {
			return html`<div class="empty-message">No report generators configured. Add generators to your project's flowti.config.json to use this feature.</div>`;
		}

		const layers = this.topoSort();

		return html`
			<div class="controls">
				<button
					class="run-all-btn"
					?disabled="${this.busy}"
					@click="${this.handleRunAll}"
				>Run All</button>
			</div>
			<div
				class="dag-container"
				style="grid-template-columns: ${layers.map(() => "1fr").join(" ")}"
			>
				${layers.map((layer, i) => html`
					<div class="dag-layer">
						<div class="dag-layer-label">Layer ${i}</div>
						${layer.map((id) => this.renderNode(id))}
					</div>
				`)}
			</div>
		`;
	}

	private renderNode(id: string) {
		const gen = this.generators.find((g) => g.id === id);
		if (!gen) return nothing;

		const state = this.nodeStates[id] ?? "not-run";
		const isExpanded = this.expandedNode === id;

		return html`
			<div
				class="node-card ${isExpanded ? "node-card--expanded" : ""}"
				@click="${() => this.toggleNode(id)}"
			>
				<div class="node-header">
					<span class="node-badge node-badge--${state}"></span>
					<span class="node-label">${gen.label}</span>
					<button
						class="node-run-btn"
						?disabled="${this.busy}"
						@click="${(e: Event) => this.handleRunNode(e, id)}"
					>Run</button>
				</div>
				${isExpanded && this.outputLines.length > 0 ? html`
					<div class="node-output">${this.outputLines.join("\n")}</div>
				` : nothing}
			</div>
		`;
	}

	/**
	 * Groups generators into topological layers.
	 * Layer 0: generators with no dependencies.
	 * Layer N: generators whose deps all appear in layers 0..N-1.
	 */
	private topoSort(): string[][] {
		const layers: string[][] = [];
		const placed = new Set<string>();
		const ids = new Set(this.generators.map((g) => g.id));
		const remaining = new Map<string, readonly string[]>();

		for (const gen of this.generators) {
			const deps = (gen.dependencies ?? []).filter((d) => ids.has(d));
			remaining.set(gen.id, deps);
		}

		while (remaining.size > 0) {
			const layer: string[] = [];
			for (const [id, deps] of remaining) {
				if (deps.every((d) => placed.has(d))) {
					layer.push(id);
				}
			}
			if (layer.length === 0) {
				// Cycle detected — place all remaining to avoid infinite loop
				layer.push(...remaining.keys());
			}
			for (const id of layer) {
				remaining.delete(id);
				placed.add(id);
			}
			layers.push(layer);
		}

		return layers;
	}

	private toggleNode(id: string): void {
		this.expandedNode = this.expandedNode === id ? null : id;
	}

	private handleRunAll(): void {
		this.dispatchEvent(new CustomEvent("report-run-all", {
			bubbles: true,
			composed: true,
		}));
	}

	private handleRunNode(e: Event, generatorId: string): void {
		e.stopPropagation();
		this.dispatchEvent(new CustomEvent("report-run", {
			detail: { generatorId },
			bubbles: true,
			composed: true,
		}));
	}
}

if (!customElements.get("flowti-tab-reporting")) customElements.define("flowti-tab-reporting", FlowtiTabReporting);
