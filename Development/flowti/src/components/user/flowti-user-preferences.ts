import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { emptyState } from '../shared-styles.js';

interface SourceSetting {
	enabled: string[];
}

interface SessionSetting {
	activityFilterGlobal: string[];
	customTypes: Record<string, unknown>;
}

interface TrainSetting {
	folder: string;
	defaultDuration: number;
	maxThoughts: number;
	autoOpenTimeline: boolean;
}

interface NudgeSetting {
	configs: unknown[];
}

interface PreferencesSettings {
	sources: SourceSetting;
	session: SessionSetting;
	train: TrainSetting;
	nudge: NudgeSetting;
}

const PANELS: ReadonlyArray<{ id: string; label: string; icon: string }> = [
	{ id: 'sources', label: 'Sources', icon: 'inbox' },
	{ id: 'session', label: 'Session', icon: 'timer' },
	{ id: 'train', label: 'Train', icon: 'train-front' },
	{ id: 'nudge', label: 'Nudge', icon: 'bell' },
];

/**
 * User Preferences — 4 sub-panels (sources, session, train, nudge).
 *
 * @property settings - Object with sub-sections for each panel
 * @property activePanel - Currently active panel ID
 *
 * @fires setting-changed - detail: { section, key, value } when a setting is modified
 * @fires panel-switched - detail: { panelId } when switching panels
 */
export class FlowtiUserPreferences extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		settings: { type: Object },
		activePanel: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		emptyState,
		css`
			.preferences-layout {
				display: flex;
				gap: var(--flowti-space-md);
				min-height: 200px;
			}

			.panel-nav {
				flex: 0 0 180px;
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}

			.panel-nav-item {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.panel-nav-item:hover {
				background: var(--background-modifier-hover);
			}

			.panel-nav-item--active {
				background: var(--background-modifier-active-hover);
				font-weight: 500;
			}

			.panel-content {
				flex: 1;
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.panel-placeholder {
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.panel-title {
				font-weight: 600;
				margin-bottom: var(--flowti-space-md);
			}

			.setting-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
			}

			.setting-label {
				font-size: var(--flowti-font-sm);
				flex: 1;
			}

			.setting-toggle {
				cursor: pointer;
			}

			.setting-input {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-size: var(--flowti-font-sm);
			}

			.setting-description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: var(--flowti-space-md);
			}
		`,
	];

	settings: PreferencesSettings = {
		sources: { enabled: [] },
		session: { activityFilterGlobal: [], customTypes: {} },
		train: { folder: '', defaultDuration: 15, maxThoughts: 100, autoOpenTimeline: true },
		nudge: { configs: [] },
	};
	activePanel = '';

	private dispatchPanelSwitched(panelId: string): void {
		this.dispatchEvent(
			new CustomEvent('panel-switched', {
				detail: { panelId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchSettingChanged(section: string, key: string, value: unknown): void {
		this.dispatchEvent(
			new CustomEvent('setting-changed', {
				detail: { section, key, value },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="preferences-layout">
				${this.renderNavigation()}
				${this.activePanel ? this.renderPanel() : this.renderPlaceholder()}
			</div>
		`;
	}

	private renderNavigation() {
		return html`
			<div class="panel-nav">
				${PANELS.map((panel) => html`
					<div
						class="panel-nav-item ${this.activePanel === panel.id ? 'panel-nav-item--active' : ''}"
						@click=${() => this.dispatchPanelSwitched(panel.id)}
					>
						${panel.label}
					</div>
				`)}
			</div>
		`;
	}

	private renderPlaceholder() {
		return html`
			<div class="panel-placeholder">
				Select a category to configure preferences.
			</div>
		`;
	}

	private renderPanel() {
		switch (this.activePanel) {
			case 'sources': return this.renderSourcesPanel();
			case 'session': return this.renderSessionPanel();
			case 'train': return this.renderTrainPanel();
			case 'nudge': return this.renderNudgePanel();
			default: return this.renderPlaceholder();
		}
	}

	private renderSourcesPanel() {
		return html`
			<div class="panel-content">
				<div class="panel-title">Sources</div>
				<div class="setting-description">
					Choose which event sources create inbox notifications.
				</div>
				${this.settings.sources.enabled.map((source) => html`
					<div class="setting-row">
						<input type="checkbox" class="setting-toggle" checked
							@change=${(e: Event) => {
								const target = e.target as HTMLInputElement;
								this.dispatchSettingChanged('sources', source, target.checked);
							}}
						/>
						<span class="setting-label">${source}</span>
					</div>
				`)}
			</div>
		`;
	}

	private renderSessionPanel() {
		return html`
			<div class="panel-content">
				<div class="panel-title">Session</div>
				<div class="setting-description">
					Activity filter, custom session types, and output templates.
				</div>
				${this.settings.session.activityFilterGlobal.map((folder) => html`
					<div class="setting-row">
						<span class="setting-label">${folder}</span>
					</div>
				`)}
			</div>
		`;
	}

	private renderTrainPanel() {
		return html`
			<div class="panel-content">
				<div class="panel-title">Train</div>
				<div class="setting-description">
					Configure defaults for train of thought capture sessions.
				</div>
				<div class="setting-row">
					<span class="setting-label">Folder</span>
					<span>${this.settings.train.folder}</span>
				</div>
				<div class="setting-row">
					<span class="setting-label">Default duration</span>
					<span>${this.settings.train.defaultDuration} min</span>
				</div>
				<div class="setting-row">
					<span class="setting-label">Max thoughts</span>
					<span>${this.settings.train.maxThoughts}</span>
				</div>
				<div class="setting-row">
					<input type="checkbox" class="setting-toggle"
						.checked=${this.settings.train.autoOpenTimeline}
						@change=${(e: Event) => {
							const target = e.target as HTMLInputElement;
							this.dispatchSettingChanged('train', 'autoOpenTimeline', target.checked);
						}}
					/>
					<span class="setting-label">Auto-open timeline</span>
				</div>
			</div>
		`;
	}

	private renderNudgePanel() {
		const configs = this.settings.nudge.configs as Array<{ id: string; title: string; time: string; enabled: boolean }>;

		return html`
			<div class="panel-content">
				<div class="panel-title">Nudge</div>
				<div class="setting-description">
					Time-based reminders to start a session.
				</div>
				${configs.length === 0
					? html`<div class="empty-state"><div class="empty-state__message">No nudges configured</div></div>`
					: configs.map((config) => html`
						<div class="setting-row">
							<input type="checkbox" class="setting-toggle"
								.checked=${config.enabled}
								@change=${(e: Event) => {
									const target = e.target as HTMLInputElement;
									this.dispatchSettingChanged('nudge', config.id, target.checked);
								}}
							/>
							<span class="setting-label">${config.title} at ${config.time}</span>
						</div>
					`)}
			</div>
		`;
	}
}

customElements.define('flowti-user-preferences', FlowtiUserPreferences);
