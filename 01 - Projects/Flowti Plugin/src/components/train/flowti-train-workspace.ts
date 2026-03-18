/**
 * Train Workspace — main orchestrator for the train detail view.
 *
 * Composes sub-components (stats, controls, breadcrumb) and renders
 * thought detail, branch links, merge section, navigation, etc.
 * The handler sets data properties; this component is purely presentational.
 *
 * @fires thought-activated - detail: { trainId, thoughtId }
 * @fires start-train - detail: {}
 * @fires pause-train - detail: { trainId }
 * @fires complete-train - detail: { trainId }
 * @fires resume-train - detail: { fromThoughtId? }
 * @fires add-thought - detail: { fromThoughtId? }
 * @fires merge-down - detail: { fromThoughtId }
 * @fires toggle-timeline - detail: { trainId }
 * @fires rename-train - detail: { trainId, currentTitle }
 * @fires undo-merge - detail: { trainId, fromId, toId }
 * @fires select-train - detail: { trainId }
 */

import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

// Sub-component side-effect imports
import './flowti-train-stats.js';
import './flowti-train-controls.js';
import './flowti-train-breadcrumb.js';

interface ThoughtData {
	id: string;
	trainId: string;
	title: string;
	path: string;
	createdAt: string;
	order: number;
}

interface RelationData {
	fromId: string;
	toId: string;
	direction: string;
}

interface TrainData {
	id: string;
	title: string;
	status: string;
	thoughts: ThoughtData[];
	relations: RelationData[];
	trainType?: string;
	createdAt: string;
	pausedAt: string | null;
	completedAt: string | null;
	parentTrainId?: string;
}

interface MergeTarget {
	targetId: string | null;
	targetTitle?: string;
}

export class FlowtiTrainWorkspace extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		train: { type: Object },
		activeThought: { type: Object },
		allThoughts: { type: Array },
		chainLength: { type: Number },
		branchCount: { type: Number },
		activePosition: { type: Object },
		prevThought: { type: Object },
		nextThought: { type: Object },
		headThought: { type: Object },
		mergeDownTarget: { type: Object },
		parentTrainTitle: { type: String },
		parentTrainId: { type: String },
		canvasPath: { type: String },
		breadcrumbPath: { type: Array },
		branches: { type: Array },
		outgoingMerges: { type: Array },
		trainTypeLabel: { type: String },
		elapsed: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.workspace { display: flex; flex-direction: column; gap: var(--flowti-space-md); padding: var(--flowti-space-sm); }
			.header { display: flex; align-items: center; gap: var(--flowti-space-sm); flex-wrap: wrap; }
			.header h3 { margin: 0; font-size: 1.1em; }
			.badge { font-size: var(--flowti-font-sm); padding: 2px var(--flowti-space-sm); border-radius: var(--flowti-radius); background: var(--background-secondary); color: var(--flowti-color-muted); }
			.spacer { flex: 1; }
			.icon-btn { background: transparent; border: none; cursor: pointer; color: var(--flowti-color-muted); padding: 4px; border-radius: var(--flowti-radius); }
			.icon-btn:hover { background: var(--background-modifier-hover); color: var(--flowti-text, inherit); }
			.section { padding: var(--flowti-space-sm) 0; }
			.nav-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--flowti-space-sm); padding: var(--flowti-space-xs) 0; border-bottom: 1px solid var(--flowti-border); }
			.nav-group { display: flex; align-items: center; gap: var(--flowti-space-xs); }
			button { display: inline-flex; align-items: center; gap: 4px; padding: var(--flowti-space-xs) var(--flowti-space-sm); border-radius: var(--flowti-radius); border: 1px solid var(--flowti-border); background: var(--background-secondary); color: var(--flowti-text, inherit); font-size: var(--flowti-font-sm); cursor: pointer; white-space: nowrap; }
			button:hover { background: var(--background-modifier-hover); }
			button:disabled { opacity: 0.4; cursor: default; }
			button:disabled:hover { background: var(--background-secondary); }
			.btn-primary { background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent); border-color: var(--flowti-color-info); }
			.btn-primary:hover { background: color-mix(in srgb, var(--flowti-color-info) 25%, transparent); }
			.btn-ghost { background: transparent; border-color: transparent; }
			.btn-ghost:hover { background: var(--background-modifier-hover); }
			.thought-detail { display: flex; flex-direction: column; gap: var(--flowti-space-sm); }
			.thought-title-row { display: flex; align-items: center; gap: var(--flowti-space-xs); }
			.thought-title-row h3 { margin: 0; font-size: 1em; }
			.info-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px var(--flowti-space-md); font-size: var(--flowti-font-sm); }
			.info-label { color: var(--flowti-color-muted); }
			.note-link { display: flex; align-items: center; gap: var(--flowti-space-xs); font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); }
			.completion-callout { padding: var(--flowti-space-md); border-radius: var(--flowti-radius); background: color-mix(in srgb, var(--flowti-color-success) 10%, transparent); }
			.completion-header { display: flex; align-items: center; gap: var(--flowti-space-sm); margin-bottom: var(--flowti-space-sm); }
			.completion-header h3 { margin: 0; font-size: 1em; }
			.completion-summary { font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); margin-bottom: var(--flowti-space-md); }
			.parent-link { display: flex; align-items: center; gap: var(--flowti-space-xs); font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); cursor: pointer; }
			.parent-link:hover { color: var(--flowti-text, inherit); }
			.canvas-callout { display: flex; align-items: center; gap: var(--flowti-space-sm); font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); }
			.branches h4, .merge-section h4 { margin: 0 0 var(--flowti-space-xs) 0; font-size: var(--flowti-font-sm); font-weight: 600; }
			.branch-link, .merge-link { display: flex; align-items: center; gap: var(--flowti-space-sm); padding: 2px var(--flowti-space-xs); font-size: var(--flowti-font-sm); cursor: pointer; border-radius: var(--flowti-radius); }
			.branch-link:hover, .merge-link:hover { background: var(--background-modifier-hover); }
			.content-preview { font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); font-style: italic; }
		`,
	];

	train: TrainData | null = null;
	activeThought: ThoughtData | null = null;
	allThoughts: ThoughtData[] = [];
	chainLength = 0;
	branchCount = 0;
	activePosition: { index: number; total: number } | null = null;
	prevThought: ThoughtData | null = null;
	nextThought: ThoughtData | null = null;
	headThought: ThoughtData | null = null;
	mergeDownTarget: MergeTarget | null = null;
	parentTrainTitle: string | null = null;
	parentTrainId: string | null = null;
	canvasPath: string | null = null;
	breadcrumbPath: ThoughtData[] = [];
	branches: ThoughtData[] = [];
	outgoingMerges: { fromId: string; toId: string; targetTitle: string }[] = [];
	trainTypeLabel = 'Free-form';
	elapsed = '';

	private emit(name: string, detail: Record<string, unknown> = {}): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}

	private emitThought(thoughtId: string): void {
		this.emit('thought-activated', { trainId: this.train?.id, thoughtId });
	}

	protected renderContent() {
		if (!this.train) {
			return html`<div style="text-align:center;padding:var(--flowti-space-xl);color:var(--flowti-color-muted)">No active train. Select one from history or start a new ride.</div>`;
		}
		const t = this.train;
		if (t.status === 'completed') {
			return html`<div class="workspace">${this.renderHeader(t)}${this.renderCompletion(t)}
				<flowti-train-stats .train=${t} .chainLength=${this.chainLength} .branchCount=${this.branchCount}></flowti-train-stats></div>`;
		}
		return html`
			<div class="workspace">
				${this.renderHeader(t)}
				${this.parentTrainId ? html`<div class="parent-link section" @click=${() => this.emit('select-train', { trainId: this.parentTrainId })}>\u2196 Parent: ${this.parentTrainTitle}</div>` : nothing}
				${this.renderNavBar(t)}
				<flowti-train-stats .train=${t} .chainLength=${this.chainLength} .branchCount=${this.branchCount} .activePosition=${this.activePosition}></flowti-train-stats>
				${this.activeThought ? this.renderThought() : nothing}
				${this.canvasPath ? html`<div class="canvas-callout section">Canvas will be created on first thought</div>` : nothing}
				${this.activeThought ? html`<div class="content-preview section">(preview available in full view)</div>` : nothing}
				${this.branches.length > 0 ? html`<div class="branches section"><h4>Branches</h4>${this.branches.map((b) => html`<div class="branch-link" @click=${() => this.emitThought(b.id)}>\u2197 ${b.title}</div>`)}</div>` : nothing}
				${this.outgoingMerges.length > 0 ? this.renderMerges() : nothing}
				${this.breadcrumbPath.length > 0 ? html`
					<flowti-train-breadcrumb .thoughts=${this.breadcrumbPath} active-thought-id=${this.activeThought?.id ?? ''} train-id=${t.id}
						@thought-activated=${(e: CustomEvent) => this.emitThought(e.detail.thoughtId)}></flowti-train-breadcrumb>` : nothing}
			</div>`;
	}

	private renderHeader(t: TrainData) {
		return html`
			<div class="header">
				<h3>Train: ${t.title}</h3>
				<button class="icon-btn" aria-label="Rename train" @click=${() => this.emit('rename-train', { trainId: t.id, currentTitle: t.title })}>&#x270F;</button>
				<span class="badge">${t.status}</span>
				<span class="badge">${this.trainTypeLabel}</span>
				<span class="spacer"></span>
				<button class="icon-btn" aria-label="Toggle timeline sidebar" @click=${() => this.emit('toggle-timeline', { trainId: t.id })}>&#x25A8;</button>
			</div>`;
	}

	private renderNavBar(t: TrainData) {
		return html`
			<div class="nav-bar">
				<button class="btn-ghost" ?disabled=${!this.prevThought} @click=${() => this.prevThought && this.emitThought(this.prevThought.id)}>\u25C4 prev</button>
				${t.status !== 'completed' ? html`
					<flowti-train-controls status=${t.status}
						@pause-train=${() => this.emit('pause-train', { trainId: t.id })}
						@resume-train=${() => this.emit('resume-train', { fromThoughtId: this.activeThought?.id })}
						@complete-train=${() => this.emit('complete-train', { trainId: t.id })}
					></flowti-train-controls>` : nothing}
				<div class="nav-group">${this.renderRightNav(t)}</div>
			</div>`;
	}

	private renderRightNav(t: TrainData) {
		if (this.mergeDownTarget && this.activeThought && t.status !== 'completed') {
			return html`<button class="btn-primary" @click=${() => this.emit('merge-down', { fromThoughtId: this.activeThought!.id })}>Merge down${this.mergeDownTarget.targetTitle ? ` \u2192 ${this.mergeDownTarget.targetTitle}` : ''}</button>`;
		}
		if (this.nextThought) {
			return html`<button class="btn-ghost" @click=${() => this.emitThought(this.nextThought!.id)}>Next \u25BA</button>`;
		}
		if (this.activeThought && t.status !== 'completed') {
			return html`<button class="btn-primary" @click=${() => this.emit('add-thought', { fromThoughtId: this.activeThought?.id })}>+ Add Thought</button>`;
		}
		return nothing;
	}

	private renderThought() {
		const th = this.activeThought!;
		const t = this.train!;
		const merged = t.relations.some((r) => r.fromId === th.id && r.direction === 'merge');
		const rel = t.relations.find((r) => r.toId === th.id);
		const dir = rel ? `\u2192 ${rel.direction}` : 'root';
		const time = new Date(th.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		return html`
			<div class="thought-detail section">
				<div class="thought-title-row"><h3>${th.title}</h3>${merged ? html`<span class="badge">Merged</span>` : nothing}</div>
				<div class="info-grid">
					<span class="info-label">Created</span><span>${time}</span>
					<span class="info-label">Order</span><span>#${th.order + 1}</span>
					<span class="info-label">Direction</span><span>${dir}</span>
				</div>
				<div class="note-link">${th.path.split('/').pop() ?? th.path}</div>
			</div>`;
	}

	private renderMerges() {
		return html`
			<div class="merge-section section"><h4>Merged into</h4>
				${this.outgoingMerges.map((m) => html`
					<div class="merge-link">
						<span>\u2192 ${m.targetTitle}</span>
						<button class="btn-ghost" aria-label="Undo merge" @click=${(e: Event) => { e.stopPropagation(); this.emit('undo-merge', { trainId: this.train?.id, fromId: m.fromId, toId: m.toId }); }}>\u21A9</button>
					</div>`)}
			</div>`;
	}

	private renderCompletion(t: TrainData) {
		const parts = [`${t.thoughts.length} thought${t.thoughts.length !== 1 ? 's' : ''}`];
		if (this.branchCount > 0) parts.push(`${this.branchCount} branch${this.branchCount !== 1 ? 'es' : ''}`);
		if (this.elapsed) parts.push(this.elapsed);
		return html`
			<div class="completion-callout">
				<div class="completion-header"><h3>Ride complete</h3></div>
				<div class="completion-summary">${parts.join(' \u00B7 ')}</div>
				<button class="btn-primary" @click=${() => this.emit('start-train')}>Start a new ride</button>
			</div>`;
	}
}

if (!customElements.get('flowti-train-workspace')) customElements.define('flowti-train-workspace', FlowtiTrainWorkspace);
