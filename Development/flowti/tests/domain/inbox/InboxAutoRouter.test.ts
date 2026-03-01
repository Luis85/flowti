import { describe, it, expect, beforeEach } from "vitest";
import {
	InboxAutoRouter,
	DEFAULT_ROUTING_RULES,
} from "../../../src/domain/inbox/InboxAutoRouter";
import type { InboxRoutingRule } from "../../../src/domain/inbox/InboxAutoRouter";

describe("InboxAutoRouter", () => {
	let router: InboxAutoRouter;

	beforeEach(() => {
		router = new InboxAutoRouter();
	});

	describe("defaults", () => {
		it("is disabled by default", () => {
			expect(router.isEnabled()).toBe(false);
		});

		it("has no rules by default", () => {
			expect(router.getRules()).toHaveLength(0);
		});

		it("DEFAULT_ROUTING_RULES has 4 entries", () => {
			expect(DEFAULT_ROUTING_RULES).toHaveLength(4);
		});
	});

	describe("setEnabled()", () => {
		it("enables routing", () => {
			router.setEnabled(true);
			expect(router.isEnabled()).toBe(true);
		});

		it("disables routing", () => {
			router.setEnabled(true);
			router.setEnabled(false);
			expect(router.isEnabled()).toBe(false);
		});
	});

	describe("setRules()", () => {
		it("stores rules as a copy", () => {
			const rules: InboxRoutingRule[] = [{ type: "idea", targetFolder: "ideas/" }];
			router.setRules(rules);
			rules.push({ type: "bug", targetFolder: "bugs/" });
			expect(router.getRules()).toHaveLength(1);
		});
	});

	describe("evaluate()", () => {
		beforeEach(() => {
			router.setEnabled(true);
			router.setRules([
				{ type: "idea", targetFolder: "00 - Connectivity/inbox/" },
				{ type: "feature", targetFolder: "00 - Connectivity/features/" },
				{ type: "bug", targetFolder: "00 - Connectivity/bugs/" },
				{ type: "learning", targetFolder: "00 - Connectivity/learnings/" },
			]);
		});

		it("returns shouldRoute=false when disabled", () => {
			router.setEnabled(false);
			const result = router.evaluate("inbox/note.md", "feature");
			expect(result.shouldRoute).toBe(false);
			expect(result.reason).toContain("disabled");
		});

		it("returns shouldRoute=false for empty type", () => {
			const result = router.evaluate("inbox/note.md", "");
			expect(result.shouldRoute).toBe(false);
			expect(result.reason).toContain("no type");
		});

		it("returns shouldRoute=false for whitespace-only type", () => {
			const result = router.evaluate("inbox/note.md", "   ");
			expect(result.shouldRoute).toBe(false);
			expect(result.reason).toContain("no type");
		});

		it("returns shouldRoute=false for unknown type", () => {
			const result = router.evaluate("inbox/note.md", "meeting");
			expect(result.shouldRoute).toBe(false);
			expect(result.reason).toContain("no rule");
		});

		it("matches type case-insensitively", () => {
			const result = router.evaluate("inbox/note.md", "Feature");
			expect(result.shouldRoute).toBe(true);
			expect(result.targetFolder).toBe("00 - Connectivity/features/");
		});

		it("returns correct target path", () => {
			const result = router.evaluate("inbox/my-feature.md", "feature");
			expect(result.shouldRoute).toBe(true);
			expect(result.targetPath).toBe("00 - Connectivity/features/my-feature.md");
		});

		it("skips files already in target folder", () => {
			const result = router.evaluate("00 - Connectivity/features/existing.md", "feature");
			expect(result.shouldRoute).toBe(false);
			expect(result.reason).toContain("already in target");
		});

		it("normalises target folder without trailing slash", () => {
			router.setRules([{ type: "idea", targetFolder: "ideas" }]);
			const result = router.evaluate("inbox/idea.md", "idea");
			expect(result.shouldRoute).toBe(true);
			expect(result.targetPath).toBe("ideas/idea.md");
		});

		it("returns shouldRoute=false for empty target folder rule", () => {
			router.setRules([{ type: "idea", targetFolder: "" }]);
			const result = router.evaluate("inbox/idea.md", "idea");
			expect(result.shouldRoute).toBe(false);
			expect(result.reason).toContain("target folder is empty");
		});

		describe("watched folder constraint", () => {
			it("routes files within watched folders", () => {
				router.setWatchedFolders(["inbox/"]);
				const result = router.evaluate("inbox/note.md", "bug");
				expect(result.shouldRoute).toBe(true);
			});

			it("rejects files outside watched folders", () => {
				router.setWatchedFolders(["inbox/"]);
				const result = router.evaluate("archive/note.md", "bug");
				expect(result.shouldRoute).toBe(false);
				expect(result.reason).toContain("not in a watched folder");
			});

			it("routes any file when no watched folders are set", () => {
				// No setWatchedFolders call — empty list = no constraint
				const result = router.evaluate("anywhere/note.md", "bug");
				expect(result.shouldRoute).toBe(true);
			});
		});

		it("extracts basename from nested path", () => {
			const result = router.evaluate("inbox/deep/nested/file.md", "learning");
			expect(result.shouldRoute).toBe(true);
			expect(result.targetPath).toBe("00 - Connectivity/learnings/file.md");
		});

		it("handles all default routing rules", () => {
			router.setRules([...DEFAULT_ROUTING_RULES]);
			const types = ["idea", "feature", "bug", "learning"];
			for (const type of types) {
				const result = router.evaluate(`inbox/${type}-note.md`, type);
				expect(result.shouldRoute).toBe(true);
				expect(result.targetFolder).toBeTruthy();
			}
		});
	});
});
