import { describe, it, expect } from "vitest";
import { DEFAULT_IBDE_FOLDERS } from "../../../src/domain/installer/folders";

describe("DEFAULT_IBDE_FOLDERS", () => {
	it("should be a non-empty array", () => {
		expect(DEFAULT_IBDE_FOLDERS.length).toBeGreaterThan(0);
	});

	it("should contain the root PARA folders", () => {
		expect(DEFAULT_IBDE_FOLDERS).toContain("00 - Connectivity");
		expect(DEFAULT_IBDE_FOLDERS).toContain("01 - Projects");
		expect(DEFAULT_IBDE_FOLDERS).toContain("02 - Areas");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources");
		expect(DEFAULT_IBDE_FOLDERS).toContain("04 - Archive");
	});

	it("should contain the var folder", () => {
		expect(DEFAULT_IBDE_FOLDERS).toContain("var");
	});

	it("should contain Connectivity sub-folders", () => {
		expect(DEFAULT_IBDE_FOLDERS).toContain("00 - Connectivity/input");
		expect(DEFAULT_IBDE_FOLDERS).toContain("00 - Connectivity/inbox");
		expect(DEFAULT_IBDE_FOLDERS).toContain("00 - Connectivity/imports");
		expect(DEFAULT_IBDE_FOLDERS).toContain("00 - Connectivity/share");
		expect(DEFAULT_IBDE_FOLDERS).toContain("00 - Connectivity/feedback");
	});

	it("should contain Resource sub-folders", () => {
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Attachments");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Bases");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Daily Notes");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Documentation");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Templates");
	});

	it("should contain Documentation sub-folders", () => {
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Documentation/Reference/Entities");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Documentation/Reference/Actors");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Documentation/How To");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Documentation/Tutorials");
		expect(DEFAULT_IBDE_FOLDERS).toContain("03 - Resources/Documentation/Guides");
	});

	it("should contain var sub-folders", () => {
		expect(DEFAULT_IBDE_FOLDERS).toContain("var/data");
		expect(DEFAULT_IBDE_FOLDERS).toContain("var/events");
		expect(DEFAULT_IBDE_FOLDERS).toContain("var/reports");
	});

	it("should have parent folders before children (ordering)", () => {
		const connectivityIdx = DEFAULT_IBDE_FOLDERS.indexOf("00 - Connectivity");
		const connectivityInputIdx = DEFAULT_IBDE_FOLDERS.indexOf("00 - Connectivity/input");

		const resourcesIdx = DEFAULT_IBDE_FOLDERS.indexOf("03 - Resources");
		const dailyNotesIdx = DEFAULT_IBDE_FOLDERS.indexOf("03 - Resources/Daily Notes");
		const docIdx = DEFAULT_IBDE_FOLDERS.indexOf("03 - Resources/Documentation");
		const howToIdx = DEFAULT_IBDE_FOLDERS.indexOf("03 - Resources/Documentation/How To");

		const varIdx = DEFAULT_IBDE_FOLDERS.indexOf("var");
		const varDataIdx = DEFAULT_IBDE_FOLDERS.indexOf("var/data");

		expect(connectivityIdx).toBeLessThan(connectivityInputIdx);
		expect(resourcesIdx).toBeLessThan(dailyNotesIdx);
		expect(docIdx).toBeLessThan(howToIdx);
		expect(varIdx).toBeLessThan(varDataIdx);
	});

	it("should not have duplicate entries", () => {
		const unique = new Set(DEFAULT_IBDE_FOLDERS);
		expect(unique.size).toBe(DEFAULT_IBDE_FOLDERS.length);
	});
});
