/**
 * Command Catalog component for the User Hub.
 *
 * Renders all registered commands in a master-detail split layout,
 * grouped by domain with search filtering. Clicking a command shows
 * its details; an execute button runs it from the detail panel.
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps } from "./types";
import type { CommandDomain, CommandMeta } from "../../infrastructure/commands/types";

const DOMAIN_LABELS: Record<CommandDomain, string> = {
	hub: "Hub",
	capture: "Capture",
	train: "Train",
	"data-exchange": "Data Exchange",
	session: "Session",
	subscription: "Subscription",
	analytics: "Analytics",
	developer: "Developer",
};

const DOMAIN_ICONS: Record<CommandDomain, string> = {
	hub: "home",
	capture: "pencil",
	train: "train-front",
	"data-exchange": "arrow-left-right",
	session: "timer",
	subscription: "bell",
	analytics: "bar-chart-2",
	developer: "code",
};

const DOMAIN_ORDER: CommandDomain[] = [
	"hub", "capture", "session", "train",
	"analytics", "data-exchange", "subscription", "developer",
];

export class UserHubCommands {
	private selectedCommandId: string | null = null;
	private collapsedDomains = new Set<string>();

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	renderMaster(filterText: string): void {
		this.masterEl.empty();

		const registry = this.deps.commandRegistry;
		if (!registry) {
			this.renderEmptyState("Command registry not available");
			return;
		}

		const allMeta = registry.getCommandsMeta();
		const filter = filterText.toLowerCase();
		const filtered = filter
			? allMeta.filter(
				(m) =>
					m.label.toLowerCase().includes(filter) ||
					m.description.toLowerCase().includes(filter) ||
					m.domain.toLowerCase().includes(filter),
			)
			: allMeta;

		if (filtered.length === 0) {
			this.renderEmptyState(filter ? "No commands match your search" : "No commands registered");
			return;
		}

		// Header
		const header = this.masterEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-session-list-header" });
		header.createSpan({
			text: `${filtered.length} command${filtered.length === 1 ? "" : "s"}`,
			cls: "ft-text-sm ft-text-muted",
		});

		// Group by domain
		const grouped = new Map<CommandDomain, CommandMeta[]>();
		for (const cmd of filtered) {
			const existing = grouped.get(cmd.domain) ?? [];
			existing.push(cmd);
			grouped.set(cmd.domain, existing);
		}

		// Render in stable order
		for (const domain of DOMAIN_ORDER) {
			const commands = grouped.get(domain);
			if (!commands || commands.length === 0) continue;
			this.renderDomainGroup(domain, commands);
		}
	}

	renderDetail(): void {
		this.detailEl.empty();

		if (!this.selectedCommandId) {
			const empty = this.detailEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-detail-empty" });
			const icon = empty.createSpan();
			setIcon(icon, "terminal");
			empty.createSpan({ text: "Select a command to view details" });
			return;
		}

		const registry = this.deps.commandRegistry;
		if (!registry) return;

		const meta = registry.getCommandsMeta().find((m) => m.id === this.selectedCommandId);
		if (!meta) return;

		this.renderCommandDetail(meta);
	}

	private renderDomainGroup(domain: CommandDomain, commands: CommandMeta[]): void {
		const isCollapsed = this.collapsedDomains.has(domain);

		const groupHeader = this.masterEl.createDiv({
			cls: "ft-flex ft-items-center ft-gap-2 ft-cursor-pointer ft-catalog-group-header",
		});

		const chevron = groupHeader.createSpan({ cls: "ft-catalog-chevron" });
		setIcon(chevron, isCollapsed ? "chevron-right" : "chevron-down");

		const domainIcon = groupHeader.createSpan();
		setIcon(domainIcon, DOMAIN_ICONS[domain]);

		groupHeader.createSpan({
			text: DOMAIN_LABELS[domain],
			cls: "ft-text-sm ft-font-medium",
		});

		groupHeader.createSpan({
			text: String(commands.length),
			cls: "ft-badge ft-badge-muted ft-text-sm",
		});

		groupHeader.addEventListener("click", () => {
			if (this.collapsedDomains.has(domain)) {
				this.collapsedDomains.delete(domain);
			} else {
				this.collapsedDomains.add(domain);
			}
			this.deps.scheduleRender();
		});

		if (isCollapsed) return;

		for (const cmd of commands) {
			const isSelected = this.selectedCommandId === cmd.id;
			const row = this.masterEl.createDiv({
				cls: `ft-catalog-row ft-cursor-pointer${isSelected ? " ft-catalog-row-active ft-session-row-selected" : ""}`,
			});

			if (cmd.icon) {
				const icon = row.createSpan({ cls: "ft-catalog-row-icon" });
				setIcon(icon, cmd.icon);
			}

			row.createSpan({ text: cmd.label });

			row.createSpan({
				text: cmd.category,
				cls: "ft-badge ft-badge-muted ft-text-sm ft-ml-auto",
			});

			row.addEventListener("click", () => {
				this.selectedCommandId = cmd.id;
				this.deps.scheduleRender();
			});
		}
	}

	private renderCommandDetail(meta: CommandMeta): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-section" });

		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		if (meta.icon) {
			const icon = titleRow.createSpan();
			setIcon(icon, meta.icon);
		}
		titleRow.createEl("h3", { text: meta.label, cls: "ft-heading" });

		const badges = header.createDiv({ cls: "ft-flex ft-gap-2 ft-text-sm ft-text-muted" });
		badges.createSpan({ text: DOMAIN_LABELS[meta.domain], cls: "ft-badge ft-badge-muted" });
		badges.createSpan({ text: meta.category, cls: "ft-badge ft-badge-muted" });

		const desc = this.detailEl.createDiv({ cls: "ft-detail-section" });
		desc.createEl("p", { text: meta.description });

		// Command ID
		const idRow = this.detailEl.createDiv({ cls: "ft-detail-section ft-flex ft-items-center ft-gap-1 ft-text-sm" });
		const idIcon = idRow.createSpan();
		setIcon(idIcon, "hash");
		idRow.createSpan({ text: meta.id, cls: "ft-text-muted" });

		// Shortcut
		if (meta.shortcut) {
			const shortcutRow = this.detailEl.createDiv({ cls: "ft-detail-section ft-flex ft-items-center ft-gap-1 ft-text-sm" });
			const kbdIcon = shortcutRow.createSpan();
			setIcon(kbdIcon, "keyboard");
			shortcutRow.createEl("kbd", { text: meta.shortcut });
		}

		// Execute button
		const actions = this.detailEl.createDiv({ cls: "ft-detail-section ft-flex ft-gap-2" });
		const execBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(execBtn, "play");
		execBtn.appendText(" Execute");
		execBtn.addEventListener("click", () => {
			void this.deps.eventBus.emit("command.execute.request", { commandId: meta.id });
		});
	}

	private renderEmptyState(message: string): void {
		const empty = this.masterEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center ft-inbox-empty" });

		const icon = empty.createDiv({ cls: "ft-inbox-empty-icon" });
		setIcon(icon, "terminal");
		icon.querySelector("svg")?.setAttribute("width", "48");
		icon.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({ text: message, cls: "ft-heading ft-heading-sm" });
		empty.createDiv({
			text: "Commands from all domains will appear here once registered.",
			cls: "ft-text-muted ft-text-sm ft-inbox-empty-hint",
		});
	}
}
