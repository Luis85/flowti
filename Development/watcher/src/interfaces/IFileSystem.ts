/**
 * File system abstraction for testability.
 * Allows mocking filesystem operations in tests without global mocks.
 */
export interface IFileSystem {
	/** Check if a path exists (file or directory) */
	exists(path: string): boolean;

	/** Read file contents as Buffer */
	readFile(path: string): Promise<Buffer>;

	/** Get file stats */
	stat(path: string): Promise<IFileStat>;

	/** Read directory entries */
	readdir(path: string): Promise<IDirent[]>;
}

/**
 * File stat information
 */
export interface IFileStat {
	mtimeMs: number;
	size: number;
	isFile(): boolean;
	isDirectory(): boolean;
}

/**
 * Directory entry
 */
export interface IDirent {
	name: string;
	isFile(): boolean;
	isDirectory(): boolean;
}

/**
 * Default implementation using Node.js fs module.
 */
export class NodeFileSystem implements IFileSystem {
	private fs = require("fs") as typeof import("fs");
	private fsp = require("fs/promises") as typeof import("fs/promises");

	exists(path: string): boolean {
		return this.fs.existsSync(path);
	}

	async readFile(path: string): Promise<Buffer> {
		return this.fsp.readFile(path);
	}

	async stat(path: string): Promise<IFileStat> {
		const stat = await this.fsp.stat(path);
		return {
			mtimeMs: stat.mtimeMs,
			size: stat.size,
			isFile: () => stat.isFile(),
			isDirectory: () => stat.isDirectory(),
		};
	}

	async readdir(path: string): Promise<IDirent[]> {
		const entries = await this.fsp.readdir(path, { withFileTypes: true });
		return entries.map((e) => ({
			name: e.name,
			isFile: () => e.isFile(),
			isDirectory: () => e.isDirectory(),
		}));
	}
}

/**
 * Singleton instance for production use.
 * Tests can inject a mock implementation instead.
 */
export const defaultFileSystem = new NodeFileSystem();
