/**
 * InboxAutoRouter — determines target folder for files based on type routing rules.
 *
 * Pure routing logic with no I/O. The InboxService delegates file-move
 * decisions to this class, then handles the actual move via FileSystemClient.
 */

/** A single routing rule: files with this type go to this folder. */
export interface InboxRoutingRule {
	/** Note type (case-insensitive match). */
	type: string;
	/** Target vault folder path. */
	targetFolder: string;
}

/** Default routing rules (disabled by default). */
export const DEFAULT_ROUTING_RULES: readonly InboxRoutingRule[] = [
	{ type: "idea", targetFolder: "00 - Connectivity/inbox/" },
	{ type: "feature", targetFolder: "00 - Connectivity/features/" },
	{ type: "bug", targetFolder: "00 - Connectivity/bugs/" },
	{ type: "learning", targetFolder: "00 - Connectivity/learnings/" },
];

/** Result of a routing decision. */
export interface RoutingDecision {
	/** Whether the file should be moved. */
	shouldRoute: boolean;
	/** Target folder (undefined if shouldRoute is false). */
	targetFolder?: string;
	/** Computed target path (undefined if shouldRoute is false). */
	targetPath?: string;
	/** Reason routing was skipped (undefined if shouldRoute is true). */
	reason?: string;
}

export class InboxAutoRouter {
	private enabled = false;
	private rules: InboxRoutingRule[] = [];
	private watchedFolders: string[] = [];

	/** Set whether auto-routing is active. */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	/** Replace the routing rules. */
	setRules(rules: InboxRoutingRule[]): void {
		this.rules = [...rules];
	}

	/** Set the watched folder paths (only route files within these). */
	setWatchedFolders(folders: string[]): void {
		this.watchedFolders = [...folders];
	}

	/** Whether auto-routing is currently enabled. */
	isEnabled(): boolean {
		return this.enabled;
	}

	/** Get the current routing rules (copy). */
	getRules(): InboxRoutingRule[] {
		return [...this.rules];
	}

	/**
	 * Determine whether a file should be routed based on its type.
	 * @param filePath Current path of the file.
	 * @param type The note type from frontmatter.
	 */
	evaluate(filePath: string, type: string): RoutingDecision {
		if (!this.enabled) {
			return { shouldRoute: false, reason: "auto-routing disabled" };
		}
		if (!type || !type.trim()) {
			return { shouldRoute: false, reason: "no type specified" };
		}

		const normalised = type.trim().toLowerCase();
		const rule = this.rules.find((r) => r.type.toLowerCase() === normalised);
		if (!rule) {
			return { shouldRoute: false, reason: `no rule for type "${type}"` };
		}

		if (!rule.targetFolder || !rule.targetFolder.trim()) {
			return { shouldRoute: false, reason: "target folder is empty" };
		}

		// Check if file is already in the target folder
		const target = normaliseFolder(rule.targetFolder);
		if (filePath.startsWith(target)) {
			return { shouldRoute: false, reason: "file already in target folder" };
		}

		// Check if file is in a watched folder
		if (this.watchedFolders.length > 0) {
			const inWatched = this.watchedFolders.some((f) => filePath.startsWith(normaliseFolder(f)));
			if (!inWatched) {
				return { shouldRoute: false, reason: "file not in a watched folder" };
			}
		}

		const basename = filePath.split("/").pop() ?? filePath;
		const targetPath = `${target}${basename}`;

		return {
			shouldRoute: true,
			targetFolder: target,
			targetPath,
		};
	}
}

/** Ensure folder path ends with '/'. */
function normaliseFolder(folder: string): string {
	return folder.endsWith("/") ? folder : `${folder}/`;
}
