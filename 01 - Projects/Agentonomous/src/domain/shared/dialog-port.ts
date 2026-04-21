/**
 * User confirmation and input dialogs.  Any "are you sure?" or
 * "name this?" interaction goes through this port instead of reaching
 * for Obsidian's Modal class directly from module code.
 */
export interface DialogPort {
	/** Ask the user to confirm (OK/Cancel).  Resolves with the user's choice. */
	confirm(opts: ConfirmOptions): Promise<boolean>;

	/** Ask the user for a string.  Resolves with the value, or null if cancelled. */
	prompt(opts: PromptOptions): Promise<string | null>;

	/**
	 * Open a folder-picker over the vault's folders. Resolves with the chosen
	 * folder path (without trailing slash), or `null` if the user dismissed
	 * the modal. Root folder is returned as the empty string `""`.
	 */
	pickFolder(opts?: PickFolderOptions): Promise<string | null>;
}

export type ConfirmOptions = {
	readonly title: string;
	readonly message: string;
	/** Default action button label.  Defaults to "Confirm". */
	readonly confirmLabel?: string;
	/** Cancel button label.  Defaults to "Cancel". */
	readonly cancelLabel?: string;
	/** If true, the confirm button renders as destructive (red).  Default false. */
	readonly destructive?: boolean;
};

export type PromptOptions = {
	readonly title: string;
	readonly message: string;
	readonly placeholder?: string;
	readonly defaultValue?: string;
	readonly confirmLabel?: string;
	readonly cancelLabel?: string;
};

export type PickFolderOptions = {
	/** Modal title / placeholder shown in the suggest UI. */
	readonly title?: string;
};
