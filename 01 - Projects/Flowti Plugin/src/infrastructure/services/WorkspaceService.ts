/**
 * WorkspaceService — abstraction over Obsidian's workspace navigation.
 *
 * UI components use this service instead of accessing `app.workspace`
 * directly, keeping the EventBridge boundary intact.
 */

/**
 * Workspace navigation interface.
 */
export interface IWorkspaceService {
	/** Open a file in the current (or nearest available) leaf. */
	openFile(path: string): Promise<void>;

	/** Open a file in a new leaf. */
	openFileInNewLeaf(path: string): Promise<void>;

	/** Navigate to a link (uses Obsidian's link resolution). */
	openLink(linkText: string): Promise<void>;

	/** Open a specific view type in a new leaf. */
	openView(viewType: string): Promise<void>;
}
