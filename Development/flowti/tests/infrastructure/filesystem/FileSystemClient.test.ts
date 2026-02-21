import { describe, it, expect } from "vitest";
import { FileSystemClient } from "../../../src/infrastructure/filesystem/FileSystemClient";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus, RequestId } from "../../../src/infrastructure/events/types";

function createClientWithBus(): { client: FileSystemClient; eventBus: IEventBus } {
	const eventBus = new EventBus();
	const client = new FileSystemClient({ eventBus, timeout: 1000 });
	return { client, eventBus };
}

describe("FileSystemClient", () => {
	describe("fileExists", () => {
		it("should return true when file exists", async () => {
			const { client, eventBus } = createClientWithBus();

			// Simulate EventBridge responding with success — pass requestId through as-is
			eventBus.on("*", (event) => {
				if (event.type === "file.read.request") {
					const p = event.payload as { requestId: RequestId; path: string };
					void eventBus.emit("file.read.response", {
						requestId: p.requestId,
						success: true,
						path: p.path,
						content: "file content",
					});
				}
			});

			const result = await client.fileExists("test/file.md");
			expect(result).toBe(true);
		});

		it("should return false when file is not found", async () => {
			const { client, eventBus } = createClientWithBus();

			eventBus.on("*", (event) => {
				if (event.type === "file.read.request") {
					const p = event.payload as { requestId: RequestId; path: string };
					void eventBus.emit("file.read.response", {
						requestId: p.requestId,
						success: false,
						path: p.path,
						error: {
							code: "FILE_READ_FAILED",
							message: `File not found: ${p.path}`,
							path: p.path,
						},
					});
				}
			});

			const result = await client.fileExists("missing/file.md");
			expect(result).toBe(false);
		});

		it("should throw on non-file-not-found errors", async () => {
			const { client, eventBus } = createClientWithBus();

			eventBus.on("*", (event) => {
				if (event.type === "file.read.request") {
					const p = event.payload as { requestId: RequestId; path: string };
					void eventBus.emit("file.read.response", {
						requestId: p.requestId,
						success: false,
						path: p.path,
						error: {
							code: "FILE_READ_FAILED",
							message: "Permission denied",
							path: p.path,
						},
					});
				}
			});

			await expect(client.fileExists("restricted/file.md")).rejects.toThrow("Permission denied");
		});

		it("should throw on timeout errors", async () => {
			const eventBus = new EventBus();
			const client = new FileSystemClient({ eventBus, timeout: 50 });

			// No response handler — will time out
			await expect(client.fileExists("test/file.md")).rejects.toThrow("timed out");
		});
	});
});
