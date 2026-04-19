/**
 * Pure decision for how a file-detail leaf should react when Obsidian
 * hands it a state change.  Kept free of Obsidian types so it can be
 * unit-tested without mocking the workspace.
 *
 * The view is the only code path that can pre-empt Obsidian's "reuse
 * current leaf" default, so the policy is consulted from setState.
 * Executing the decision is the view's job — this module only decides.
 */

export type TabDecision =
	/** Let super.setState handle the state change in this leaf. */
	| { readonly kind: 'accept' }
	/**
	 * Leave this leaf untouched; activate an existing file-detail leaf
	 * that already shows the requested file.  The index references the
	 * `existingLeafPaths` array supplied to the decision.
	 */
	| { readonly kind: 'activate'; readonly leafIndex: number }
	/** Leave this leaf untouched; open the requested file in a fresh tab. */
	| { readonly kind: 'newTab'; readonly path: string };

export type TabDecisionInput = {
	/** Path of the file currently displayed in this leaf, or undefined for a fresh view. */
	readonly currentPath: string | undefined;
	/** Path of the file Obsidian is asking us to display, or null if the state carries no file. */
	readonly newPath: string | null;
	/**
	 * Paths of files shown in *other* file-detail leaves (not this one).
	 * Used to dedupe so we never open a second tab for the same file.
	 * null entries are allowed (a leaf without a file) and are skipped.
	 */
	readonly otherLeafPaths: readonly (string | null)[];
};

export function decideTabAction(input: TabDecisionInput): TabDecision {
	if (input.currentPath === undefined) return { kind: 'accept' };
	if (input.newPath === null) return { kind: 'accept' };
	if (input.currentPath === input.newPath) return { kind: 'accept' };
	const idx = input.otherLeafPaths.indexOf(input.newPath);
	if (idx >= 0) return { kind: 'activate', leafIndex: idx };
	return { kind: 'newTab', path: input.newPath };
}
