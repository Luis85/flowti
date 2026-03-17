import { describe, it, expect, vi } from "vitest";
import { resolveStartPageViewType, openStartPage } from "../../src/infrastructure/StartpageHandler";
import {
	VIEW_TYPE_USER_HUB,
	VIEW_TYPE_EVENT_CATALOG,
	VIEW_TYPE_DATA_EXCHANGE_HUB,
	VIEW_TYPE_ANALYTICS_HUB,
	VIEW_TYPE_TRAIN_HUB,
} from "../../src/domain/hub/types";
import type { FlowtiSettings } from "../../src/domain/settings/settings";

describe("StartpageHandler", () => {
	describe("resolveStartPageViewType", () => {
		it("should return null for 'none'", () => {
			expect(resolveStartPageViewType("none")).toBeNull();
		});

		it("should map user-hub to VIEW_TYPE_USER_HUB", () => {
			expect(resolveStartPageViewType("user-hub")).toBe(VIEW_TYPE_USER_HUB);
		});

		it("should map event-catalog to VIEW_TYPE_EVENT_CATALOG", () => {
			expect(resolveStartPageViewType("event-catalog")).toBe(VIEW_TYPE_EVENT_CATALOG);
		});

		it("should map data-exchange-hub to VIEW_TYPE_DATA_EXCHANGE_HUB", () => {
			expect(resolveStartPageViewType("data-exchange-hub")).toBe(VIEW_TYPE_DATA_EXCHANGE_HUB);
		});

		it("should map analytics-hub to VIEW_TYPE_ANALYTICS_HUB", () => {
			expect(resolveStartPageViewType("analytics-hub")).toBe(VIEW_TYPE_ANALYTICS_HUB);
		});

		it("should map train-hub to VIEW_TYPE_TRAIN_HUB", () => {
			expect(resolveStartPageViewType("train-hub")).toBe(VIEW_TYPE_TRAIN_HUB);
		});
	});

	describe("openStartPage", () => {
		function makeWorkspace() {
			const leaf = {
				setViewState: vi.fn(async () => {}),
			};
			return {
				getLeaf: vi.fn(() => leaf),
				revealLeaf: vi.fn(async () => {}),
				_leaf: leaf,
			};
		}

		it("should not open anything when startPage is 'none'", () => {
			const workspace = makeWorkspace();
			openStartPage(workspace as never, "none");

			expect(workspace.getLeaf).not.toHaveBeenCalled();
		});

		it("should open user hub when startPage is 'user-hub'", () => {
			const workspace = makeWorkspace();
			openStartPage(workspace as never, "user-hub");

			expect(workspace.getLeaf).toHaveBeenCalledWith("tab");
			expect(workspace._leaf.setViewState).toHaveBeenCalledWith({
				type: VIEW_TYPE_USER_HUB,
				active: true,
			});
			expect(workspace.revealLeaf).toHaveBeenCalled();
		});

		it("should open analytics hub when startPage is 'analytics-hub'", () => {
			const workspace = makeWorkspace();
			openStartPage(workspace as never, "analytics-hub");

			expect(workspace._leaf.setViewState).toHaveBeenCalledWith({
				type: VIEW_TYPE_ANALYTICS_HUB,
				active: true,
			});
		});
	});

	describe("settings default", () => {
		it("should default startPage to 'none'", async () => {
			const { DEFAULT_SETTINGS } = await import("../../src/domain/settings/settings");
			expect(DEFAULT_SETTINGS.startPage).toBe("none");
		});

		it("should accept all valid startPage values", async () => {
			const { FlowtiSettingsSchema } = await import("../../src/domain/settings/settings");
			const values: FlowtiSettings["startPage"][] = [
				"none", "user-hub", "event-catalog", "data-exchange-hub", "analytics-hub", "train-hub",
			];
			for (const v of values) {
				const result = FlowtiSettingsSchema.safeParse({ startPage: v });
				expect(result.success, `startPage="${v}" should be valid`).toBe(true);
			}
		});

		it("should reject invalid startPage values", async () => {
			const { FlowtiSettingsSchema } = await import("../../src/domain/settings/settings");
			const result = FlowtiSettingsSchema.safeParse({ startPage: "invalid-page" });
			expect(result.success).toBe(false);
		});

		it("should be backward compatible with settings missing startPage", async () => {
			const { FlowtiSettingsSchema } = await import("../../src/domain/settings/settings");
			const result = FlowtiSettingsSchema.safeParse({});
			expect(result.success).toBe(true);
			expect(result.data?.startPage).toBe("none");
		});
	});
});
