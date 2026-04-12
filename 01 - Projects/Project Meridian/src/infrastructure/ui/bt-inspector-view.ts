import { ItemView, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import type { AgentActor } from '../entity/agent-actor.js';
import type { VaultReader } from '../entity/agent-spawner.js';
import type { Logger } from '../../domain/core/logger.js';
import type { NodeDetails } from 'mistreevous/dist/nodes/Node.js';
import { renderTree } from './bt-tree-renderer.js';
import { loadStaticTree, type TreeRef } from './bt-tree-loader.js';
import { parseState, type BTInspectorState } from './bt-inspector-state.js';

export const MERIDIAN_BT_INSPECTOR_VIEW_TYPE = 'meridian-bt-inspector';

const REFRESH_INTERVAL_MS = 500;

export interface BTInspectorDeps {
	getAgents: () => AgentActor[];
	getAgentById: (id: string) => AgentActor | undefined;
	vault: VaultReader;
	logger: Logger;
	dataRoot: () => string;
}

interface StaticTreeEntry {
	label: string;
	makeRef: (dataRoot: string) => TreeRef;
}


export class MeridianBTInspectorView extends ItemView {
	private deps: BTInspectorDeps | null;
	private mode: 'index' | 'detail' = 'index';
	private currentAgentId: string | null = null;
	private currentStaticRef: TreeRef | null = null;
	private currentStaticLabel: string | null = null;
	private refreshInterval: number | null = null;
	private treeContainer: HTMLElement | null = null;
	/** Incremented on every detail-mode switch to cancel stale async loads. */
	private loadSeq = 0;

	constructor(leaf: WorkspaceLeaf, deps: BTInspectorDeps | null) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return MERIDIAN_BT_INSPECTOR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'BT Inspector';
	}

	getIcon(): string {
		return 'git-branch';
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.setCssProps({
			padding: '12px',
			'font-family': 'var(--font-monospace)',
			'font-size': '11px',
		});
		this.renderIndex();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.stopRefresh();
		return Promise.resolve();
	}

	getState(): Record<string, unknown> {
		const state: BTInspectorState = {};
		if (this.currentAgentId !== null) {
			state.agentId = this.currentAgentId;
		} else if (this.currentStaticRef !== null && this.currentStaticLabel !== null) {
			state.staticRef = this.currentStaticRef;
			state.staticLabel = this.currentStaticLabel;
		}
		return state as unknown as Record<string, unknown>;
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const s = parseState(state);
		if (s.agentId !== undefined) {
			await this.showAgent(s.agentId);
		} else if (s.staticRef !== undefined && s.staticLabel !== undefined) {
			await this.showStaticTree(s.staticRef, s.staticLabel);
		}
		await super.setState(state, result);
	}

	/** Update deps after game initialization (called by plugin) */
	setDeps(deps: BTInspectorDeps): void {
		this.deps = deps;
		// Refresh whichever mode is active so stale placeholders get real data
		if (this.mode === 'index') {
			this.renderIndex();
		} else if (this.currentAgentId !== null) {
			void this.showAgent(this.currentAgentId);
		} else if (this.currentStaticRef !== null && this.currentStaticLabel !== null) {
			void this.showStaticTree(this.currentStaticRef, this.currentStaticLabel);
		}
	}

	showAgent(agentId: string): Promise<void> {
		this.loadSeq++;
		this.currentAgentId = agentId;
		this.currentStaticRef = null;
		this.currentStaticLabel = null;
		this.mode = 'detail';
		this.stopRefresh();
		this.renderDetail();
		this.startRefresh();
		return Promise.resolve();
	}

	async showStaticTree(ref: TreeRef, label: string): Promise<void> {
		const seq = ++this.loadSeq;
		this.currentAgentId = null;
		this.currentStaticRef = ref;
		this.currentStaticLabel = label;
		this.mode = 'detail';
		this.stopRefresh();

		if (this.deps === null) {
			this.renderError('Game not loaded');
			return;
		}

		try {
			const details = await loadStaticTree(this.deps.vault, ref, this.deps.logger);
			// If another showAgent / showStaticTree fired while we were loading, drop this result.
			if (seq !== this.loadSeq) return;
			this.renderStaticDetail(label, details);
		} catch (err) {
			if (seq !== this.loadSeq) return;
			const message = err instanceof Error ? err.message : String(err);
			this.renderError(`Failed to load tree: ${message}`);
		}
	}

	private renderIndex(): void {
		this.contentEl.empty();
		this.mode = 'index';
		this.stopRefresh();
		this.loadSeq++; // cancel any in-flight static-tree load
		this.currentAgentId = null;
		this.currentStaticRef = null;
		this.currentStaticLabel = null;

		const headerRow = this.contentEl.createDiv();
		headerRow.setCssProps({ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-top': '0', 'margin-bottom': '8px' });
		const header = headerRow.createEl('h3', { text: 'Behavior Trees' });
		header.setCssProps({ 'margin-top': '0', 'margin-bottom': '0', flex: '1' });
		const refreshBtn = headerRow.createEl('button', { text: '↻ Refresh' });
		refreshBtn.addEventListener('click', () => { this.renderIndex(); });

		// Static trees section
		const staticSection = this.contentEl.createDiv();
		staticSection.createEl('h4', { text: 'Static Trees' });

		if (this.deps === null) {
			staticSection.createEl('div', { text: 'Game not loaded yet' });
		} else {
			// NOTE: dataRoot is resolved lazily at click time, not at render time.
			// That way, if the inspector is opened before the game view has populated
			// dataRoot, clicking a row after the game loads still resolves the correct path.
			const entries: StaticTreeEntry[] = [
				{
					label: 'base.mdsl',
					makeRef: (root) => ({ kind: 'base', path: `${root}/behavior-trees/base.mdsl` }),
				},
				{
					label: 'default (base + default)',
					makeRef: (root) => ({ kind: 'job', branchPath: `${root}/jobs/default.mdsl`, basePath: `${root}/behavior-trees/base.mdsl` }),
				},
			];

			for (const entry of entries) {
				const row = staticSection.createDiv();
				row.setCssProps({ cursor: 'pointer', padding: '4px 8px', 'border-radius': '4px' });
				row.textContent = `🌳 ${entry.label}`;
				row.addEventListener('click', () => {
					if (this.deps === null) return;
					const root = this.deps.dataRoot();
					if (root === '') {
						this.renderError('Game not yet loaded — open the Project Meridian game view first');
						return;
					}
					void this.showStaticTree(entry.makeRef(root), entry.label);
				});
				row.addEventListener('mouseenter', () => { row.setCssProps({ background: 'var(--background-modifier-hover)' }); });
				row.addEventListener('mouseleave', () => { row.setCssProps({ background: '' }); });
			}
		}

		// Live agents section
		const liveSection = this.contentEl.createDiv();
		liveSection.setCssProps({ 'margin-top': '16px' });
		liveSection.createEl('h4', { text: 'Live Agents' });

		if (this.deps === null) {
			liveSection.createEl('div', { text: 'Waiting for game to load...' });
		} else {
			const agents = this.deps.getAgents();
			if (agents.length === 0) {
				liveSection.createEl('div', { text: '(no agents)' });
			} else {
				for (const agent of agents) {
					const row = liveSection.createDiv();
					row.setCssProps({ cursor: 'pointer', padding: '4px 8px', 'border-radius': '4px' });
					const jobLabel = agent.job ?? 'jobless';
					row.textContent = `👤 ${agent.agentName} — ${jobLabel}`;
					row.addEventListener('click', () => void this.showAgent(agent.agentId));
					row.addEventListener('mouseenter', () => { row.setCssProps({ background: 'var(--background-modifier-hover)' }); });
					row.addEventListener('mouseleave', () => { row.setCssProps({ background: '' }); });
				}
			}
		}
	}

	private renderDetail(): void {
		if (this.currentAgentId === null || this.deps === null) {
			this.renderError('No agent selected');
			return;
		}

		this.contentEl.empty();

		const header = this.contentEl.createDiv();
		header.setCssProps({ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '12px' });

		const backBtn = header.createEl('button', { text: '← Back' });
		backBtn.addEventListener('click', () => { this.renderIndex(); });

		const agent = this.deps.getAgentById(this.currentAgentId);
		if (agent === undefined) {
			this.renderError('Agent no longer available');
			return;
		}

		const title = header.createEl('span');
		title.textContent = `${agent.agentName} (${agent.job ?? 'jobless'})`;
		title.setCssProps({ 'font-weight': 'bold' });

		this.treeContainer = this.contentEl.createDiv();
		this.refreshTree();
	}

	private renderStaticDetail(label: string, details: NodeDetails): void {
		this.contentEl.empty();

		const header = this.contentEl.createDiv();
		header.setCssProps({ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '12px' });

		const backBtn = header.createEl('button', { text: '← Back' });
		backBtn.addEventListener('click', () => { this.renderIndex(); });

		const title = header.createEl('span');
		title.textContent = label;
		title.setCssProps({ 'font-weight': 'bold' });

		const treeContainer = this.contentEl.createDiv();
		treeContainer.appendChild(renderTree(details));
		this.treeContainer = treeContainer;
	}

	private renderError(message: string): void {
		this.contentEl.empty();
		const header = this.contentEl.createDiv();
		header.setCssProps({ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '12px' });
		const backBtn = header.createEl('button', { text: '← Back' });
		backBtn.addEventListener('click', () => { this.renderIndex(); });
		const errEl = this.contentEl.createDiv();
		errEl.textContent = message;
		errEl.setCssProps({ color: 'var(--text-error)' });
	}

	private refreshTree(): void {
		if (this.treeContainer === null || this.currentAgentId === null || this.deps === null) return;
		const agent = this.deps.getAgentById(this.currentAgentId);
		if (agent === undefined) {
			// Agent disappeared — fall back to index
			this.renderIndex();
			return;
		}
		try {
			const details = agent.behaviorTree.getTreeNodeDetails();
			this.treeContainer.empty();
			this.treeContainer.appendChild(renderTree(details));
		} catch (err) {
			this.deps.logger.warn('BTInspector', `Refresh failed: ${String(err)}`);
			// Keep previous render, continue polling
		}
	}

	private startRefresh(): void {
		this.stopRefresh();
		this.refreshInterval = window.setInterval(() => {
			if (!this.containerEl.isShown()) return;
			this.refreshTree();
		}, REFRESH_INTERVAL_MS);
	}

	private stopRefresh(): void {
		if (this.refreshInterval !== null) {
			window.clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}
}
