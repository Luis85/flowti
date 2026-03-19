import { describe, it, expect } from "vitest";
import { normalizeGitUrl, extractRepoName } from "../../../src/domain/project/git-url.js";

describe("normalizeGitUrl", () => {
	it("appends .git to bare GitHub HTTPS URL", () => {
		expect(normalizeGitUrl("https://github.com/user/repo")).toBe("https://github.com/user/repo.git");
	});

	it("strips /tree/main path from GitHub URL", () => {
		expect(normalizeGitUrl("https://github.com/user/repo/tree/main/src")).toBe("https://github.com/user/repo.git");
	});

	it("passes through SSH URLs unchanged", () => {
		expect(normalizeGitUrl("git@github.com:user/repo.git")).toBe("git@github.com:user/repo.git");
	});

	it("strips /-/tree path from GitLab URL", () => {
		expect(normalizeGitUrl("https://gitlab.com/user/repo/-/tree/main")).toBe("https://gitlab.com/user/repo.git");
	});

	it("strips /src/main from Bitbucket URL", () => {
		expect(normalizeGitUrl("https://bitbucket.org/user/repo/src/main")).toBe("https://bitbucket.org/user/repo.git");
	});

	it("passes through Azure DevOps _git URL", () => {
		expect(normalizeGitUrl("https://dev.azure.com/org/project/_git/repo")).toBe("https://dev.azure.com/org/project/_git/repo");
	});

	it("converts legacy visualstudio.com to dev.azure.com", () => {
		expect(normalizeGitUrl("https://org.visualstudio.com/project/_git/repo")).toBe("https://dev.azure.com/org/project/_git/repo");
	});

	it("strips query params from Azure DevOps URL", () => {
		expect(normalizeGitUrl("https://dev.azure.com/org/project/_git/repo?path=/src&version=GBmain")).toBe("https://dev.azure.com/org/project/_git/repo");
	});

	it("passes through generic .git URL unchanged", () => {
		expect(normalizeGitUrl("https://example.com/repo.git")).toBe("https://example.com/repo.git");
	});

	it("returns empty string for empty input", () => {
		expect(normalizeGitUrl("")).toBe("");
	});
});

describe("extractRepoName", () => {
	it("extracts name from GitHub URL", () => {
		expect(extractRepoName("https://github.com/user/my-app.git")).toBe("my-app");
	});

	it("extracts name from Azure DevOps URL", () => {
		expect(extractRepoName("https://dev.azure.com/org/project/_git/repo")).toBe("repo");
	});

	it("extracts name from SSH URL", () => {
		expect(extractRepoName("git@github.com:user/cool-lib.git")).toBe("cool-lib");
	});

	it("returns empty string for empty input", () => {
		expect(extractRepoName("")).toBe("");
	});
});
