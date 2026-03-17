import type { ILayout, LayoutConfig, LayoutRegion } from "./types";

export interface SplitLayoutConfig extends LayoutConfig {
	/** Ratio of primary pane width as a fraction (0–1). Default: 0.3 */
	ratio?: number;
}

/**
 * Split layout — primary/inspector panes with configurable ratio.
 *
 * Regions: "primary", "inspector"
 */
export class SplitLayout implements ILayout {
	readonly type = "split";

	private root: HTMLElement | null = null;
	private primaryRegion: LayoutRegion | null = null;
	private inspectorRegion: LayoutRegion | null = null;
	private readonly ratio: number;

	constructor(config?: SplitLayoutConfig) {
		this.ratio = config?.ratio ?? 0.3;
	}

	mount(container: HTMLElement): void {
		this.dispose();

		this.root = document.createElement("div");
		this.root.className = "ft-layout ft-layout-split";
		this.root.style.setProperty("--ft-split-ratio", `${(this.ratio * 100).toFixed(0)}%`);

		const primary = document.createElement("div");
		primary.className = "ft-layout-primary";

		const inspector = document.createElement("div");
		inspector.className = "ft-layout-inspector";

		this.root.appendChild(primary);
		this.root.appendChild(inspector);

		this.primaryRegion = { el: primary };
		this.inspectorRegion = { el: inspector };
		container.appendChild(this.root);
	}

	getRegion(name: string): LayoutRegion | null {
		if (name === "primary") return this.primaryRegion;
		if (name === "inspector") return this.inspectorRegion;
		return null;
	}

	dispose(): void {
		if (this.root) {
			this.root.remove();
			this.root = null;
		}
		this.primaryRegion = null;
		this.inspectorRegion = null;
	}
}
