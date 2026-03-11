import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/fs.js", () => ({
	writeFileAt: vi.fn(() => true),
}));

import { writeFileAt } from "../../../../src/infrastructure/fs.js";
import { createFileWriter } from "../../../../src/domain/make/templates/file-writer.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createFileWriter", () => {
	it("returns an object with write method and created getter", () => {
		const writer = createFileWriter("/base");

		expect(typeof writer.write).toBe("function");
		expect(typeof writer.created).toBe("number");
	});

	it("starts with 0 created count", () => {
		const writer = createFileWriter("/base");

		expect(writer.created).toBe(0);
	});

	it("delegates write to writeFileAt with correct base path", () => {
		const writer = createFileWriter("/base/path");

		writer.write("src/index.ts", "console.log('hello');");

		expect(writeFileAt).toHaveBeenCalledWith("/base/path", "src/index.ts", "console.log('hello');");
	});

	it("increments created count on successful write", () => {
		vi.mocked(writeFileAt).mockReturnValue(true);
		const writer = createFileWriter("/base");

		writer.write("file1.ts", "content1");
		writer.write("file2.ts", "content2");

		expect(writer.created).toBe(2);
	});

	it("does not increment created count on failed write", () => {
		vi.mocked(writeFileAt).mockReturnValue(false);
		const writer = createFileWriter("/base");

		writer.write("existing.ts", "content");

		expect(writer.created).toBe(0);
	});

	it("returns true when writeFileAt succeeds", () => {
		vi.mocked(writeFileAt).mockReturnValue(true);
		const writer = createFileWriter("/base");

		expect(writer.write("file.ts", "content")).toBe(true);
	});

	it("returns false when writeFileAt fails", () => {
		vi.mocked(writeFileAt).mockReturnValue(false);
		const writer = createFileWriter("/base");

		expect(writer.write("file.ts", "content")).toBe(false);
	});

	it("tracks mixed success/failure writes correctly", () => {
		vi.mocked(writeFileAt)
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(true)
			.mockReturnValueOnce(false);

		const writer = createFileWriter("/base");

		writer.write("file1.ts", "a");
		writer.write("file2.ts", "b");
		writer.write("file3.ts", "c");
		writer.write("file4.ts", "d");

		expect(writer.created).toBe(2);
	});

	it("uses the basePath for all writes from the same writer", () => {
		vi.mocked(writeFileAt).mockReturnValue(true);
		const writer = createFileWriter("/project");

		writer.write("src/a.ts", "a");
		writer.write("src/b.ts", "b");

		expect(writeFileAt).toHaveBeenNthCalledWith(1, "/project", "src/a.ts", "a");
		expect(writeFileAt).toHaveBeenNthCalledWith(2, "/project", "src/b.ts", "b");
	});
});
