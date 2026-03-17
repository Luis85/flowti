// ═══════════════════════════════════════════════════════════════════════════════
// PANEL BUILDER (OPTIONAL FLUENT API)
// ═══════════════════════════════════════════════════════════════════════════════

import { PanelConfig } from "src/ui";


export class PanelBuilder {
	private config: Partial<PanelConfig> = {};

	static create(id: string): PanelBuilder {
		const builder = new PanelBuilder();
		builder.config.id = id;
		builder.config.name = id; // Default name = id
		return builder;
	}

	name(name: string): this {
		this.config.name = name;
		return this;
	}

	title(title: string): this {
		this.config.title = title;
		return this;
	}

	icon(icon: string): this {
		this.config.icon = icon;
		return this;
	}

	withHeader(): this {
		this.config.showHeader = true;
		return this;
	}

	withFooter(): this {
		this.config.showFooter = true;
		return this;
	}

	cssClasses(...classes: string[]): this {
		this.config.cssClasses = classes;
		return this;
	}

	build(): PanelConfig {
		if (!this.config.id) {
			throw new Error("Panel id is required");
		}
		return this.config as PanelConfig;
	}
}
