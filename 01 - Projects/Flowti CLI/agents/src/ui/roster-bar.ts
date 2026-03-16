import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles } from "./shared-styles.js";
import { resolveSettingForDomain } from "../config/domain-map.js";
import { SCENE_THEMES } from "../config/settings.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent, Setting } from "../data/types.js";

@customElement("roster-bar")
export class RosterBar extends LitElement {
	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 44px;
				background: #0f172a;
				border-top: 1px solid #1e293b;
				display: flex;
				align-items: center;
				padding: 0 12px;
				gap: 6px;
				z-index: 50;
				overflow-x: auto;
				overflow-y: hidden;
			}
			.card {
				background: var(--bg-secondary);
				border-radius: 4px;
				padding: 4px 10px;
				cursor: pointer;
				display: flex;
				flex-direction: column;
				min-width: 70px;
				transition: background 0.15s;
				flex-shrink: 0;
			}
			.card:hover {
				background: var(--bg-tertiary);
			}
			.card-top {
				display: flex;
				align-items: center;
				gap: 4px;
			}
			.status-dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				flex-shrink: 0;
			}
			.agent-name {
				font-size: 10px;
				font-weight: 600;
				color: var(--text-primary);
			}
			.agent-location {
				font-size: 8px;
				color: var(--text-muted);
				margin-top: 1px;
			}
		`,
	];

	@property({ attribute: false }) store!: DashboardStore;

	private unsubscribe: (() => void) | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.requestUpdate();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	private get domainAgents(): readonly DashboardAgent[] {
		return (this.store?.agents ?? []).filter(
			(a) => resolveSettingForDomain(a.domain) !== "hub",
		);
	}

	private statusColor(status: DashboardAgent["status"]): string {
		if (status === "busy") return "#22c55e";
		if (status === "idle") return "#3b82f6";
		return "#6b7280";
	}

	private truncate(name: string): string {
		return name.length > 9 ? name.slice(0, 8) + "\u2026" : name;
	}

	private handleCardClick(setting: Setting): void {
		this.store.changeScene(setting);
	}

	render() {
		return html`${this.domainAgents.map((agent) => {
			const setting = resolveSettingForDomain(agent.domain);
			const label = SCENE_THEMES[setting]?.label ?? setting;
			const dotColor = this.statusColor(agent.status);
			const truncName = this.truncate(agent.name);

			return html`
				<div class="card" @click=${() => this.handleCardClick(setting)}>
					<div class="card-top">
						<span class="status-dot" style="background:${dotColor}"></span>
						<span class="agent-name">${truncName}</span>
					</div>
					<div class="agent-location">${label}</div>
				</div>
			`;
		})}`;
	}
}
