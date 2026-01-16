import { describe, it, expect, beforeEach, vi } from "vitest";
import { LogService, LogLevel, LogCategory } from "../../src/services/LogService";

describe("LogService", () => {
	beforeEach(() => {
		// Clear logs before each test
		LogService.clear();
		// Reset to default configuration
		LogService.configure({
			enabled: true,
			minLevel: "debug",
			maxEntries: 1000,
		});
	});

	describe("basic logging", () => {
		it("should log messages at different levels", () => {
			LogService.debug("Plugin", "Debug message");
			LogService.info("Plugin", "Info message");
			LogService.warn("Plugin", "Warning message");
			LogService.error("Plugin", "Error message");

			expect(LogService.count).toBe(4);

			const logs = LogService.getLogs();
			expect(logs[0].level).toBe("debug");
			expect(logs[1].level).toBe("info");
			expect(logs[2].level).toBe("warn");
			expect(logs[3].level).toBe("error");
		});

		it("should include message and category", () => {
			LogService.info("Watcher", "Test message");

			const logs = LogService.getLogs();
			expect(logs[0].message).toBe("Test message");
			expect(logs[0].category).toBe("Watcher");
		});

		it("should include optional details", () => {
			LogService.info("Sync", "File synced", {
				details: { fileSize: 1024, duration: 50 },
				mappingId: "map-1",
				filePath: "/path/to/file.md",
			});

			const logs = LogService.getLogs();
			expect(logs[0].details).toEqual({ fileSize: 1024, duration: 50 });
			expect(logs[0].mappingId).toBe("map-1");
			expect(logs[0].filePath).toBe("/path/to/file.md");
		});

		it("should assign unique IDs to entries", () => {
			LogService.info("Plugin", "Message 1");
			LogService.info("Plugin", "Message 2");

			const logs = LogService.getLogs();
			expect(logs[0].id).not.toBe(logs[1].id);
		});

		it("should include timestamps", () => {
			const before = new Date();
			LogService.info("Plugin", "Test");
			const after = new Date();

			const logs = LogService.getLogs();
			expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(
				before.getTime()
			);
			expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(
				after.getTime()
			);
		});
	});

	describe("filtering", () => {
		beforeEach(() => {
			LogService.debug("Plugin", "Debug 1");
			LogService.info("Watcher", "Info 1", { mappingId: "map-1" });
			LogService.warn("Sync", "Warning 1", { filePath: "/test.md" });
			LogService.error("Reconcile", "Error 1");
			LogService.info("Plugin", "Info 2", { mappingId: "map-2" });
		});

		it("should filter by level", () => {
			const errors = LogService.getLogs({ levels: ["error"] });
			expect(errors.length).toBe(1);
			expect(errors[0].message).toBe("Error 1");

			const warnings = LogService.getLogs({ levels: ["warn", "error"] });
			expect(warnings.length).toBe(2);
		});

		it("should filter by category", () => {
			const pluginLogs = LogService.getLogs({ categories: ["Plugin"] });
			expect(pluginLogs.length).toBe(2);
		});

		it("should filter by mappingId", () => {
			const map1Logs = LogService.getLogs({ mappingId: "map-1" });
			expect(map1Logs.length).toBe(1);
			expect(map1Logs[0].message).toBe("Info 1");
		});

		it("should filter by search text", () => {
			const searchLogs = LogService.getLogs({ search: "warning" });
			expect(searchLogs.length).toBe(1);
			expect(searchLogs[0].message).toBe("Warning 1");
		});

		it("should filter by search in file path", () => {
			const searchLogs = LogService.getLogs({ search: "test.md" });
			expect(searchLogs.length).toBe(1);
		});

		it("should combine multiple filters", () => {
			const filtered = LogService.getLogs({
				levels: ["info"],
				categories: ["Plugin"],
			});
			expect(filtered.length).toBe(1);
			expect(filtered[0].message).toBe("Info 2");
		});
	});

	describe("getRecentLogs", () => {
		it("should return most recent logs first", () => {
			LogService.info("Plugin", "First");
			LogService.info("Plugin", "Second");
			LogService.info("Plugin", "Third");

			const recent = LogService.getRecentLogs(2);
			expect(recent.length).toBe(2);
			expect(recent[0].message).toBe("Third");
			expect(recent[1].message).toBe("Second");
		});

		it("should apply filters to recent logs", () => {
			LogService.info("Plugin", "Info 1");
			LogService.error("Plugin", "Error 1");
			LogService.info("Plugin", "Info 2");

			const recent = LogService.getRecentLogs(10, { levels: ["error"] });
			expect(recent.length).toBe(1);
			expect(recent[0].message).toBe("Error 1");
		});
	});

	describe("getCounts", () => {
		it("should return counts by level", () => {
			LogService.debug("Plugin", "D1");
			LogService.debug("Plugin", "D2");
			LogService.info("Plugin", "I1");
			LogService.warn("Plugin", "W1");
			LogService.error("Plugin", "E1");
			LogService.error("Plugin", "E2");
			LogService.error("Plugin", "E3");

			const counts = LogService.getCounts();
			expect(counts.debug).toBe(2);
			expect(counts.info).toBe(1);
			expect(counts.warn).toBe(1);
			expect(counts.error).toBe(3);
		});
	});

	describe("configuration", () => {
		it("should respect minLevel setting", () => {
			LogService.configure({ minLevel: "warn" });

			LogService.debug("Plugin", "Debug");
			LogService.info("Plugin", "Info");
			LogService.warn("Plugin", "Warn");
			LogService.error("Plugin", "Error");

			expect(LogService.count).toBe(2);
			const logs = LogService.getLogs();
			expect(logs[0].level).toBe("warn");
			expect(logs[1].level).toBe("error");
		});

		it("should respect enabled setting", () => {
			LogService.configure({ enabled: false });

			LogService.info("Plugin", "Should not log");

			expect(LogService.count).toBe(0);
		});

		it("should trim logs when maxEntries is exceeded", () => {
			LogService.configure({ maxEntries: 5 });

			for (let i = 0; i < 10; i++) {
				LogService.info("Plugin", `Message ${i}`);
			}

			expect(LogService.count).toBe(5);

			const logs = LogService.getLogs();
			expect(logs[0].message).toBe("Message 5");
			expect(logs[4].message).toBe("Message 9");
		});
	});

	describe("subscribe", () => {
		it("should notify subscribers on new log entries", () => {
			const listener = vi.fn();
			const unsubscribe = LogService.subscribe(listener);

			LogService.info("Plugin", "Test message");

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					message: "Test message",
					level: "info",
				})
			);

			unsubscribe();
		});

		it("should stop notifying after unsubscribe", () => {
			const listener = vi.fn();
			const unsubscribe = LogService.subscribe(listener);

			LogService.info("Plugin", "Before unsubscribe");
			unsubscribe();
			LogService.info("Plugin", "After unsubscribe");

			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe("clear", () => {
		it("should remove all logs", () => {
			LogService.info("Plugin", "Message 1");
			LogService.info("Plugin", "Message 2");
			expect(LogService.count).toBe(2);

			LogService.clear();

			expect(LogService.count).toBe(0);
			expect(LogService.getLogs()).toEqual([]);
		});
	});

	describe("exportAsJson", () => {
		it("should export logs as JSON string", () => {
			LogService.info("Plugin", "Test");

			const json = LogService.exportAsJson();
			const parsed = JSON.parse(json);

			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed[0].message).toBe("Test");
		});
	});

	describe("getErrorCountSince", () => {
		it("should count errors since a given time", async () => {
			LogService.error("Plugin", "Old error");

			// Wait a tiny bit
			await new Promise((r) => setTimeout(r, 10));
			const since = new Date();
			await new Promise((r) => setTimeout(r, 10));

			LogService.error("Plugin", "New error 1");
			LogService.error("Plugin", "New error 2");
			LogService.info("Plugin", "Info message");

			const count = LogService.getErrorCountSince(since);
			expect(count).toBe(2);
		});
	});
});
