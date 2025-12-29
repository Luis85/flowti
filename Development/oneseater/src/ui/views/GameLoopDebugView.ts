import { ItemView, WorkspaceLeaf } from "obsidian";

export const GAMELOOP_DEBUG_VIEW = "gameloop-debug-view";

export class GameLoopDebugView extends ItemView {

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return GAMELOOP_DEBUG_VIEW;
  }

  getDisplayText() {
    return "GameLoop Debug";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
  }

  async onClose() {
  }

}
