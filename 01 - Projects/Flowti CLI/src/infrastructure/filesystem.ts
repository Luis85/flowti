/**
 * filesystem.ts — File system abstraction for the CLI.
 *
 * All file I/O routes through this service so tests can inject a mock.
 * The shared `disk` instance is the default for production code.
 */

import fsNode from "node:fs";
import type { IFileSystem, DirEntry } from "./types.js";

class NodeFileSystem implements IFileSystem {
	readFileSync(path: string, encoding: BufferEncoding): string {
		return fsNode.readFileSync(path, encoding);
	}

	writeFileSync(path: string, content: string, encoding: BufferEncoding): void {
		fsNode.writeFileSync(path, content, encoding);
	}

	existsSync(path: string): boolean {
		return fsNode.existsSync(path);
	}

	mkdirSync(path: string, options?: fsNode.MakeDirectoryOptions): void {
		fsNode.mkdirSync(path, options);
	}

	readdirSync(path: string): string[];
	readdirSync(path: string, options: { withFileTypes: true }): DirEntry[];
	readdirSync(path: string, options?: { withFileTypes: true }): string[] | DirEntry[] {
		if (options?.withFileTypes) {
			return fsNode.readdirSync(path, { withFileTypes: true });
		}
		return fsNode.readdirSync(path);
	}

	copyFileSync(src: string, dest: string): void {
		fsNode.copyFileSync(src, dest);
	}

	rmSync(path: string, options?: fsNode.RmOptions): void {
		fsNode.rmSync(path, options);
	}

	unlinkSync(path: string): void {
		fsNode.unlinkSync(path);
	}

	statSync(path: string): fsNode.Stats {
		return fsNode.statSync(path);
	}
}

export const disk: IFileSystem = new NodeFileSystem();
