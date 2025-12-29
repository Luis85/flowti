import { ItemView, WorkspaceLeaf } from "obsidian";
export const EXAMPLE_VIEW_TYPE = "example-view";

export class ExampleView extends ItemView {

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return EXAMPLE_VIEW_TYPE;
	}

	getDisplayText() {
		return "An Example Obisidan View";
	}

	// ─────────────────────────────────────────────────────────────
	// Lifecycle
	// ─────────────────────────────────────────────────────────────

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		console.log('View opened')
	}

	async onClose() {
		console.log('View closed')
	}

}

