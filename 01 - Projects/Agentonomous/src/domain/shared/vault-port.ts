import type { Result } from './result.js';
import type { Unsubscribe } from './unsubscribe.js';

export type VaultFile = {
	readonly path: string;
	readonly content: string;
	readonly frontmatter: Record<string, unknown>;
	readonly stat: { readonly size: number; readonly ctime: number; readonly mtime: number };
};

export type VaultChangeKind = 'create' | 'modify' | 'delete' | 'rename';

export type VaultChange = {
	readonly kind: VaultChangeKind;
	readonly path: string;
	/** Previous path, present only for rename events. */
	readonly oldPath?: string;
	readonly at: number;
};

export interface VaultPort {
	read(path: string): Promise<Result<VaultFile, string>>;
	create(path: string, content: string): Promise<Result<void, string>>;
	update(path: string, content: string): Promise<Result<void, string>>;
	delete(path: string): Promise<Result<void, string>>;
	rename(oldPath: string, newPath: string): Promise<Result<void, string>>;
	exists(path: string): Promise<boolean>;
	list(folder: string): Promise<Result<string[], string>>;

	/**
	 * Ensure a folder path exists in the vault, creating missing segments
	 * (including nested parents). Idempotent: calling with an existing folder
	 * returns ok. Returns err if a file of the same path blocks creation
	 * (path conflict) or the adapter cannot create the folder for any reason.
	 * Root (`""` or `"/"`) is a no-op.
	 */
	ensureFolder(path: string): Promise<Result<void, string>>;

	/**
	 * Subscribe to vault change events (create/modify/delete/rename).  The
	 * returned Unsubscribe detaches the listener.  Infrastructure adapters
	 * also mirror these events on the `vault` bus channel so modules can
	 * subscribe without holding a port reference.
	 */
	watch(listener: (change: VaultChange) => void): Unsubscribe;
}
