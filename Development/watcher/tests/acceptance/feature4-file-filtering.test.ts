/**
 * Feature 4: File Filtering — Acceptance Tests
 *
 * Covers which files are included or excluded from sync operations
 * based on extension, pattern, type, and link status.
 *
 * @see docs/testplan.md — UC-15 through UC-19
 */

import { describe, it, expect, vi } from "vitest";

import {
	isAllowedByExtensions,
	matchesExcludePattern,
	isTempFile,
	createIgnoredMatcher,
	isSymlinkSync,
} from "../../src/utils";

// ===========================
// Feature 4: File Filtering
// ===========================

describe("Feature 4: File Filtering", () => {

	// ==========================================
	// UC-15: File Extension Filtering
	// ==========================================
	describe("UC-15: File Extension Filtering", () => {

		it("Scenario 15.1: Allowed extensions are synced", () => {
			expect(isAllowedByExtensions("notes.md", [".md", ".txt"])).toBe(true);
			expect(isAllowedByExtensions("readme.txt", [".md", ".txt"])).toBe(true);
		});

		it("Scenario 15.2: Non-matching extensions are ignored", () => {
			expect(isAllowedByExtensions("image.png", [".md"])).toBe(false);
		});

		it("Scenario 15.3: Empty extension list means all files allowed", () => {
			expect(isAllowedByExtensions("anything.xyz", [])).toBe(true);
			expect(isAllowedByExtensions("file.pdf", [])).toBe(true);
		});

		it("Scenario 15.4: Files without extension are rejected when filter is active", () => {
			expect(isAllowedByExtensions("Makefile", [".md"])).toBe(false);
		});

		it("Scenario 15.5: Extension matching is case-insensitive", () => {
			// path.extname returns ".MD", the list has ".md"
			// isAllowedByExtensions lowercases the ext before comparison
			expect(isAllowedByExtensions("README.MD", [".md"])).toBe(true);
		});
	});

	// ==========================================
	// UC-16: Exclude Patterns
	// ==========================================
	describe("UC-16: Exclude Patterns", () => {

		it("Scenario 16.1: Exact name pattern match (node_modules)", () => {
			expect(matchesExcludePattern("node_modules/pkg/index.js", ["node_modules"])).toBe(true);
		});

		it("Scenario 16.2: Wildcard extension match (*.log)", () => {
			expect(matchesExcludePattern("debug.log", ["*.log"])).toBe(true);
		});

		it("Scenario 16.3: Double-star glob match (build/**)", () => {
			expect(matchesExcludePattern("build/output/bundle.js", ["build/**"])).toBe(true);
		});

		it("Scenario 16.4: Single-char wildcard match (file?.txt)", () => {
			expect(matchesExcludePattern("file1.txt", ["file?.txt"])).toBe(true);
			// ? only matches one character — "file12.txt" should NOT match
			expect(matchesExcludePattern("file12.txt", ["file?.txt"])).toBe(false);
		});

		it("Scenario 16.5: Empty or whitespace patterns are ignored", () => {
			expect(matchesExcludePattern("any-file.md", ["", "  "])).toBe(false);
		});

		it("Non-matching patterns allow files through", () => {
			expect(matchesExcludePattern("readme.md", ["*.log", "build/**"])).toBe(false);
		});
	});

	// ==========================================
	// UC-17: Temp File / System File Filtering
	// ==========================================
	describe("UC-17: Temp / System File Filtering", () => {

		it("Scenario 17.1: Office lock files are ignored (~$document.docx)", () => {
			expect(isTempFile("~$document.docx")).toBe(true);
		});

		it("Scenario 17.2: Temporary file extensions are ignored (.tmp, .temp, .swp, .partial, .crdownload)", () => {
			expect(isTempFile("data.tmp")).toBe(true);
			expect(isTempFile("data.temp")).toBe(true);
			expect(isTempFile("file.swp")).toBe(true);
			expect(isTempFile("file.partial")).toBe(true);
			expect(isTempFile("installer.crdownload")).toBe(true);
		});

		it("Scenario 17.3: System files are ignored (thumbs.db, .DS_Store, desktop.ini)", () => {
			expect(isTempFile("thumbs.db")).toBe(true);
			expect(isTempFile("Thumbs.db")).toBe(true);
			expect(isTempFile(".DS_Store")).toBe(true);
			expect(isTempFile(".ds_store")).toBe(true);
			expect(isTempFile("desktop.ini")).toBe(true);
		});

		it("Scenario 17.4: Partial downloads are ignored", () => {
			expect(isTempFile("installer.crdownload")).toBe(true);
			expect(isTempFile("archive.partial")).toBe(true);
		});

		it("Scenario 17.5: Regular files starting with ~ are NOT filtered if they have an extension", () => {
			// ~notes.txt has an extension → NOT treated as temp file
			expect(isTempFile("~notes.txt")).toBe(false);
			// ~filename (no extension, no $) → IS a generic temp file
			expect(isTempFile("~tempname")).toBe(true);
		});

		it("Regular files are not filtered", () => {
			expect(isTempFile("report.md")).toBe(false);
			expect(isTempFile("data.csv")).toBe(false);
			expect(isTempFile("image.png")).toBe(false);
		});
	});

	// ==========================================
	// UC-18: Dotfile Filtering
	// ==========================================
	describe("UC-18: Dotfile Filtering", () => {

		it("Scenario 18.1: Dotfiles in source root are ignored", () => {
			const matcher = createIgnoredMatcher(false);
			expect(matcher(".gitignore")).toBe(true);
			expect(matcher(".env")).toBe(true);
		});

		it("Scenario 18.2: Dot-directories and their contents are ignored", () => {
			const matcher = createIgnoredMatcher(false);
			expect(matcher(".git/config")).toBe(true);
			expect(matcher(".obsidian/workspace.json")).toBe(true);
			expect(matcher("/some/path/.vscode/settings.json")).toBe(true);
		});

		it("Scenario 18.3: Regular files in regular folders are unaffected", () => {
			const matcher = createIgnoredMatcher(false);
			expect(matcher("readme.md")).toBe(false);
			expect(matcher("docs/readme.md")).toBe(false);
			expect(matcher("/some/path/file.txt")).toBe(false);
		});

		it("Temp file filtering is combined with dotfile filtering when enabled", () => {
			const matcher = createIgnoredMatcher(true);
			// Dotfiles still caught
			expect(matcher(".gitignore")).toBe(true);
			// Temp files also caught
			expect(matcher("~$document.docx")).toBe(true);
			expect(matcher("data.tmp")).toBe(true);
			// Regular files pass
			expect(matcher("readme.md")).toBe(false);
		});
	});

	// ==========================================
	// UC-19: Symlink Protection
	// ==========================================
	describe("UC-19: Symlink Protection", () => {

		it("Scenario 19.1: isSymlinkSync returns false for non-existent paths", () => {
			// Safe to call on non-existent paths — returns false
			expect(isSymlinkSync("/nonexistent/path/that/does/not/exist")).toBe(false);
		});

		it("Scenario 19.3: Symlink check on deleted files returns false (safe)", () => {
			// Deleted files don't exist on disk → returns false, no error
			expect(isSymlinkSync("/tmp/deleted-file-" + Date.now())).toBe(false);
		});

		it.skip("Scenario 19.1: Symlinked file is skipped during sync (requires real symlink)", () => {
			// Requires creating a real symlink on the filesystem
		});

		it.skip("Scenario 19.2: Symlinked directory is skipped during walk", () => {
			// Requires creating a real symlink directory on the filesystem
		});
	});
});
