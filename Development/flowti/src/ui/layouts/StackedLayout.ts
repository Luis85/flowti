import type { ILayout, LayoutConfig, LayoutRegion } from "./types";

export interface SectionConfig {
	id: string;
}

export interface StackedLayoutConfig extends LayoutConfig {
	sections: SectionConfig[];
}

/**
 * Stacked layout — vertical stack of named content sections.
 *
 * Regions: each section's id (e.g. "header", "body", "footer")
 */
export class StackedLayout implements ILayout {
	readonly type = "stacked";

	private root: HTMLElement | null = null;
	private sectionRegions: Map<string, LayoutRegion> = new Map();
	private readonly sections: SectionConfig[];

	constructor(config?: StackedLayoutConfig) {
		this.sections = config?.sections ?? [];
	}

	mount(container: HTMLElement): void {
		this.dispose();

		this.root = document.createElement("div");
		this.root.className = "ft-layout ft-layout-stacked";

		for (const section of this.sections) {
			const el = document.createElement("div");
			el.className = "ft-layout-section";
			el.dataset.sectionId = section.id;
			this.root.appendChild(el);
			this.sectionRegions.set(section.id, { el });
		}

		container.appendChild(this.root);
	}

	getRegion(name: string): LayoutRegion | null {
		return this.sectionRegions.get(name) ?? null;
	}

	dispose(): void {
		if (this.root) {
			this.root.remove();
			this.root = null;
		}
		this.sectionRegions.clear();
	}
}
