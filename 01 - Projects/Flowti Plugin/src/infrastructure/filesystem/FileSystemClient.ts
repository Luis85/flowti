/**
 * FileSystemClient - Promise-based client for file operations via events.
 *
 * This client provides a clean API for services to perform file operations
 * without directly accessing the Obsidian API. All operations are performed
 * via the EventBus, making services fully testable.
 *
 * @example
 * ```typescript
 * const client = new FileSystemClient({ eventBus });
 *
 * // Create a file
 * await client.createFile("notes/new-note.md", "# Hello World");
 *
 * // Read a file
 * const content = await client.readFile("notes/new-note.md");
 *
 * // Update frontmatter
 * await client.updateFrontmatter("notes/new-note.md", { status: "done" });
 * ```
 */

import type {
	IEventBus,
	EventType,
	RequestId,
	FileResponseBase,
	FileOperationError,
} from "../events/types";
import type {
	FileSystemClientOptions,
	CreateFileOptions,
	FileOperationOptions,
	IFileSystemClient,
} from "./types";
import { generateUUID } from "../../utils/helpers";

/**
 * Generic response payload structure for file operations.
 */
interface FileResponsePayload extends FileResponseBase {
	content?: string;
	newPath?: string;
	files?: string[];
	data?: Record<string, unknown>;
	error?: FileOperationError;
}

/**
 * Generate a unique request ID for correlating requests with responses.
 */
function generateRequestId(): RequestId {
	return generateUUID() as unknown as RequestId;
}

/**
 * FileSystemClient implementation.
 */
export class FileSystemClient implements IFileSystemClient {
	private eventBus: IEventBus;
	private defaultTimeout: number;
	private pendingRequests = new Map<RequestId, { unsubscribe: () => void; timeoutId: ReturnType<typeof setTimeout>; reject: (err: Error) => void }>();
	private disposed = false;

	constructor(options: FileSystemClientOptions) {
		this.eventBus = options.eventBus;
		this.defaultTimeout = options.timeout ?? 5000;
	}

	dispose(): void {
		this.disposed = true;
		const cancelError = new Error("FileSystemClient disposed");
		for (const [, entry] of this.pendingRequests) {
			clearTimeout(entry.timeoutId);
			entry.unsubscribe();
			entry.reject(cancelError);
		}
		this.pendingRequests.clear();
	}

	async fileExists(path: string, options?: FileOperationOptions): Promise<boolean> {
		try {
			await this.readFile(path, options);
			return true;
		} catch (err) {
			if (err instanceof Error && err.message.startsWith("File not found:")) {
				return false;
			}
			throw err;
		}
	}

	async createFile(
		path: string,
		content: string,
		options?: CreateFileOptions
	): Promise<void> {
		const requestId = generateRequestId();

		return this.request(
			"file.create.request",
			"file.create.response",
			{ requestId, path, content, createFolders: options?.createFolders },
			requestId,
			options?.timeout
		);
	}

	async readFile(path: string, options?: FileOperationOptions): Promise<string> {
		const requestId = generateRequestId();

		return this.request(
			"file.read.request",
			"file.read.response",
			{ requestId, path },
			requestId,
			options?.timeout,
			(response) => response.content ?? ""
		);
	}

	async updateFile(
		path: string,
		content: string,
		options?: FileOperationOptions
	): Promise<void> {
		const requestId = generateRequestId();

		return this.request(
			"file.update.request",
			"file.update.response",
			{ requestId, path, content },
			requestId,
			options?.timeout
		);
	}

	async deleteFile(path: string, options?: FileOperationOptions): Promise<void> {
		const requestId = generateRequestId();

		return this.request(
			"file.delete.request",
			"file.delete.response",
			{ requestId, path },
			requestId,
			options?.timeout
		);
	}

	async moveFile(
		path: string,
		newPath: string,
		options?: FileOperationOptions
	): Promise<string> {
		const requestId = generateRequestId();

		return this.request(
			"file.move.request",
			"file.move.response",
			{ requestId, path, newPath },
			requestId,
			options?.timeout,
			(response) => response.newPath ?? path
		);
	}

	async renameFile(
		path: string,
		newName: string,
		options?: FileOperationOptions
	): Promise<string> {
		const requestId = generateRequestId();

		return this.request(
			"file.rename.request",
			"file.rename.response",
			{ requestId, path, newName },
			requestId,
			options?.timeout,
			(response) => response.newPath ?? path
		);
	}

	async listFiles(folderPath: string, options?: FileOperationOptions): Promise<string[]> {
		const requestId = generateRequestId();

		return this.request(
			"file.list.request",
			"file.list.response",
			{ requestId, path: folderPath },
			requestId,
			options?.timeout,
			(response) => response.files ?? []
		);
	}

	async ensureFolder(folderPath: string, options?: FileOperationOptions): Promise<void> {
		const requestId = generateRequestId();

		return this.request(
			"folder.ensure.request",
			"folder.ensure.response",
			{ requestId, path: folderPath },
			requestId,
			options?.timeout
		);
	}

	async getFrontmatter(
		path: string,
		options?: FileOperationOptions
	): Promise<Record<string, unknown>> {
		const requestId = generateRequestId();

		return this.request(
			"frontmatter.get.request",
			"frontmatter.get.response",
			{ requestId, path },
			requestId,
			options?.timeout,
			(response) => response.data ?? {}
		);
	}

	async updateFrontmatter(
		path: string,
		data: Record<string, unknown>,
		options?: FileOperationOptions
	): Promise<Record<string, unknown>> {
		const requestId = generateRequestId();

		return this.request(
			"frontmatter.update.request",
			"frontmatter.update.response",
			{ requestId, path, data },
			requestId,
			options?.timeout,
			(response) => response.data ?? {}
		);
	}

	async setFrontmatter(
		path: string,
		data: Record<string, unknown>,
		options?: FileOperationOptions
	): Promise<void> {
		const requestId = generateRequestId();

		return this.request(
			"frontmatter.set.request",
			"frontmatter.set.response",
			{ requestId, path, data },
			requestId,
			options?.timeout
		);
	}

	/**
	 * Generic request/response pattern.
	 * Emits a request event and waits for the corresponding response.
	 *
	 * Uses a type-specific handler (not a wildcard) so the response is
	 * delivered immediately — before any wildcard listeners process the event.
	 */
	private request<T>(
		requestEvent: EventType,
		responseEvent: EventType,
		payload: Record<string, unknown>,
		requestId: RequestId,
		timeout?: number,
		transform?: (response: FileResponsePayload) => T
	): Promise<T> {
		if (this.disposed) {
			return Promise.reject(new Error("FileSystemClient disposed"));
		}

		return new Promise((resolve, reject) => {
			const timeoutMs = timeout ?? this.defaultTimeout;
			let settled = false;

			const cleanup = (): void => {
				this.pendingRequests.delete(requestId);
			};

			// Set up timeout
			const timeoutId = setTimeout(() => {
				if (settled) return;
				settled = true;
				unsubscribe();
				cleanup();
				reject(new Error(`Request timed out after ${timeoutMs}ms`));
			}, timeoutMs);

			// Listen for response using a type-specific handler so delivery
			// is immediate — runs before wildcard listeners.
			const handler = (event: { payload: FileResponsePayload }): void => {
				const respPayload = event.payload;
				if (respPayload.requestId !== requestId) return;
				if (settled) return;
				settled = true;

				clearTimeout(timeoutId);
				unsubscribe();
				cleanup();

				if (respPayload.success) {
					resolve(transform ? transform(respPayload) : (undefined as unknown as T));
				} else {
					const error = respPayload.error;
					reject(new Error(error?.message ?? "Operation failed"));
				}
			};

			const unsubscribe = this.eventBus.on(
				responseEvent as never,
				handler as never,
			);

			this.pendingRequests.set(requestId, { unsubscribe, timeoutId, reject });

			// Emit request
			void this.eventBus.emit(requestEvent, payload as never);
		});
	}
}
