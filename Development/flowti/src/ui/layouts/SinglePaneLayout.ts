import type { ILayout, LayoutRegion } from "./types";

/**
 * Single-pane layout — full-width content area.
 *
 * Regions: "content"
 */
export class SinglePaneLayout implements ILayout {
	readonly type = "single";

	private root: HTMLElement | null = null;
	private contentRegion: LayoutRegion | null = null;

	mount(container: HTMLElement): void {
		this.dispose();

		this.root = document.createElement("div");
		this.root.className = "ft-layout ft-layout-single";

		const content = document.createElement("div");
		content.className = "ft-layout-content";
		this.root.appendChild(content);

		this.contentRegion = { el: content };
		container.appendChild(this.root);
	}

	getRegion(name: string): LayoutRegion | null {
		if (name === "content") return this.contentRegion;
		return null;
	}

	dispose(): void {
		if (this.root) {
			this.root.remove();
			this.root = null;
		}
		this.contentRegion = null;
	}
}
