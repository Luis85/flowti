import type { Result } from './result.js';

export type VaultFile = {
	readonly path: string;
	readonly content: string;
	readonly frontmatter: Record<string, unknown>;
	readonly stat: { readonly size: number; readonly ctime: number; readonly mtime: number };
};

export interface VaultPort {
	read(path: string): Promise<Result<VaultFile, string>>;
	create(path: string, content: string): Promise<Result<void, string>>;
	update(path: string, content: string): Promise<Result<void, string>>;
	delete(path: string): Promise<Result<void, string>>;
	exists(path: string): Promise<boolean>;
	list(folder: string): Promise<Result<string[], string>>;
}
