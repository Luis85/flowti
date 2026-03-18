/**
 * Train Capture Form — Lit component for thought capture.
 *
 * Can be mounted inside an Obsidian Modal wrapper or standalone.
 *
 * @fires submit-thought - detail: { title, direction }
 * @fires merge-down - detail: { title }
 * @fires complete-train - When Complete is clicked
 * @fires pause-train - When Pause is clicked
 * @fires navigate - detail: { action: "back"|"next"|"up"|"down" }
 * @fires rename-thought - detail: { newTitle }
 */

import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

const DIRECTIONS = [
	{ value: 'next', label: 'Continue chain \u2192' },
	{ value: 'branch', label: 'Branch \u2197' },
];
const MERGE_OPT = { value: 'merge-down', label: 'Merge down \u2193' };

export class FlowtiTrainCapture extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		trainTitle: { type: String, attribute: 'train-title' },
		previousThoughtTitle: { type: String, attribute: 'previous-thought-title' },
		thoughtCount: { type: Number, attribute: 'thought-count' },
		durationMinutes: { type: Number, attribute: 'duration-minutes' },
		remainingMs: { type: Number, attribute: 'remaining-ms' },
		defaultDirection: { type: String, attribute: 'default-direction' },
		isBranchEndpoint: { type: Boolean, attribute: 'is-branch-endpoint' },
		defaultMergeDown: { type: Boolean, attribute: 'default-merge-down' },
		isMerged: { type: Boolean, attribute: 'is-merged' },
		hasBack: { type: Boolean, attribute: 'has-back' },
		hasNext: { type: Boolean, attribute: 'has-next' },
		hasUp: { type: Boolean, attribute: 'has-up' },
		hasDown: { type: Boolean, attribute: 'has-down' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.capture-form { display: flex; flex-direction: column; gap: var(--flowti-space-md); }
			.title-row { display: flex; align-items: center; gap: var(--flowti-space-sm); }
			.title-row h3 { margin: 0; font-size: 1.1em; }
			.merged-badge, .tab-hint { font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); }
			.merged-badge { padding: 2px var(--flowti-space-xs); border-radius: var(--flowti-radius); background: var(--background-secondary); }
			.timer { font-size: 1.4em; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--flowti-color-muted); }
			.input-row label { display: block; font-size: var(--flowti-font-sm); color: var(--flowti-color-muted); margin-bottom: var(--flowti-space-xs); }
			.input-row input, .rename-input { width: 100%; padding: var(--flowti-space-sm); border: 1px solid var(--flowti-border); border-radius: var(--flowti-radius); background: var(--background-primary); color: var(--text-normal); font-size: 1em; box-sizing: border-box; }
			.rename-input { font-size: 1.1em; font-weight: 600; flex: 1; }
			.direction-row { display: flex; align-items: center; gap: var(--flowti-space-sm); }
			.direction-row select { padding: var(--flowti-space-xs) var(--flowti-space-sm); border-radius: var(--flowti-radius); border: 1px solid var(--flowti-border); background: var(--background-primary); color: var(--text-normal); font-size: var(--flowti-font-sm); }
			.action-row { display: flex; align-items: center; gap: var(--flowti-space-xs); flex-wrap: wrap; }
			.action-row .spacer { flex: 1; }
			button { padding: var(--flowti-space-xs) var(--flowti-space-sm); border-radius: var(--flowti-radius); border: 1px solid var(--flowti-border); background: var(--background-secondary); color: var(--flowti-text, inherit); font-size: var(--flowti-font-sm); cursor: pointer; }
			button:hover { background: var(--background-modifier-hover); }
			.btn-primary { background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent); border-color: var(--flowti-color-info); font-weight: 600; }
			.btn-primary:hover { background: color-mix(in srgb, var(--flowti-color-info) 25%, transparent); }
			.rename-btn { background: transparent; border: none; cursor: pointer; color: var(--flowti-color-muted); padding: 2px; }
			.rename-btn:hover { color: var(--flowti-text, inherit); }
		`,
	];

	trainTitle = '';
	previousThoughtTitle: string | null = null;
	thoughtCount = 0;
	durationMinutes = 0;
	remainingMs = 0;
	defaultDirection = 'next';
	isBranchEndpoint = false;
	defaultMergeDown = false;
	isMerged = false;
	hasBack = false;
	hasNext = false;
	hasUp = false;
	hasDown = false;

	private titleValue = '';
	private selectedDirection = '';
	private isRenaming = false;

	connectedCallback(): void {
		super.connectedCallback();
		this.selectedDirection = (this.defaultMergeDown && this.isBranchEndpoint)
			? 'merge-down' : (this.defaultDirection || 'next');
	}

	private get dirOpts() {
		const opts = [...DIRECTIONS];
		if (this.isBranchEndpoint) opts.push(MERGE_OPT);
		return opts;
	}

	private formatTimer(ms: number): string {
		const s = Math.max(0, Math.floor(ms / 1000));
		return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
	}

	private onSubmit(): void {
		const trimmed = this.titleValue.trim();
		if (!trimmed) return;
		const name = this.selectedDirection === 'merge-down' ? 'merge-down' : 'submit-thought';
		const detail = this.selectedDirection === 'merge-down'
			? { title: trimmed }
			: { title: trimmed, direction: this.selectedDirection };
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}

	private emit(name: string, detail: Record<string, unknown> = {}): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}

	private onInputKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') { e.preventDefault(); this.onSubmit(); }
		else if (e.key === 'Tab' && this.previousThoughtTitle) {
			e.preventDefault();
			const opts = this.dirOpts;
			const idx = opts.findIndex((o) => o.value === this.selectedDirection);
			this.selectedDirection = opts[(idx + 1) % opts.length].value;
			this.requestUpdate();
		}
	}

	private onRenameSubmit(newTitle: string): void {
		this.isRenaming = false;
		if (newTitle && newTitle !== this.previousThoughtTitle) {
			this.emit('rename-thought', { newTitle });
		}
		this.requestUpdate();
	}

	protected renderContent() {
		const title = this.previousThoughtTitle ?? this.trainTitle;
		return html`
			<div class="capture-form">
				${this.isRenaming ? html`
					<div class="title-row">
						<input class="rename-input" type="text" .value=${title}
							@blur=${(e: Event) => this.onRenameSubmit((e.target as HTMLInputElement).value.trim())}
							@keydown=${(e: KeyboardEvent) => {
								if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
								if (e.key === 'Escape') { this.isRenaming = false; this.requestUpdate(); }
							}} />
					</div>
				` : html`
					<div class="title-row">
						<h3>${title}</h3>
						${this.isMerged ? html`<span class="merged-badge">Merged</span>` : nothing}
						${this.previousThoughtTitle ? html`<button class="rename-btn" aria-label="Rename thought" @click=${() => { this.isRenaming = true; this.requestUpdate(); }}>&#x270F;</button>` : nothing}
					</div>
				`}
				${this.durationMinutes > 0 ? html`<div class="timer">${this.formatTimer(this.remainingMs)}</div>` : nothing}
				<div class="input-row">
					<label>Thought #${this.thoughtCount + 1}</label>
					<input type="text" placeholder="What\u2019s on your mind\u2026"
						@input=${(e: Event) => { this.titleValue = (e.target as HTMLInputElement).value; }}
						@keydown=${(e: KeyboardEvent) => this.onInputKeydown(e)} />
				</div>
				${this.previousThoughtTitle ? html`
					<div class="direction-row">
						<span class="tab-hint">Tab to cycle</span>
						<select .value=${this.selectedDirection} @change=${(e: Event) => { this.selectedDirection = (e.target as HTMLSelectElement).value; }}>
							${this.dirOpts.map((o) => html`<option value=${o.value} ?selected=${o.value === this.selectedDirection}>${o.label}</option>`)}
						</select>
					</div>
				` : nothing}
				<div class="action-row">
					${this.hasBack ? html`<button @click=${() => this.emit('navigate', { action: 'back' })}>\u25C4 back</button>` : nothing}
					<span class="spacer"></span>
					${this.hasUp ? html`<button @click=${() => this.emit('navigate', { action: 'up' })}>\u2191 up</button>` : nothing}
					${this.hasDown ? html`<button @click=${() => this.emit('navigate', { action: 'down' })}>\u2193 down</button>` : nothing}
					${this.hasNext ? html`<button @click=${() => this.emit('navigate', { action: 'next' })}>Next \u25BA</button>` : nothing}
					<button @click=${() => this.emit('pause-train')}>Pause</button>
					<button @click=${() => this.emit('complete-train')}>Complete</button>
					<button class="btn-primary" @click=${this.onSubmit}>Add thought</button>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-train-capture')) customElements.define('flowti-train-capture', FlowtiTrainCapture);
