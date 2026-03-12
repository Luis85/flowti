import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		readdirSync: vi.fn(),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import {
	listDataProviders,
	readDataProvider,
	inferSchema,
	createDataProvider,
	generateDataDictionary,
	regenerateDataDictionary,
} from "../../../../src/domain/make/component/data-provider.js";

const mockDisk = vi.mocked(disk);
const mockClock = { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" };

function deps() { return { disk, paths, clock: mockClock } as any; }

beforeEach(() => {
	vi.clearAllMocks();
});

describe("listDataProviders", () => {
	it("returns empty array when providers dir does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(listDataProviders("/project", deps())).toEqual([]);
	});

	it("discovers json files in providers directory", () => {
		mockDisk.existsSync.mockImplementation((p: string) => {
			if (String(p).endsWith(".md")) return true;
			return true;
		});
		mockDisk.readdirSync.mockReturnValue(["users.json", "products.json"] as never);
		mockDisk.readFileSync.mockReturnValue(JSON.stringify([{ id: 1 }, { id: 2 }]));

		const providers = listDataProviders("/project", deps());
		expect(providers).toHaveLength(2);
		expect(providers[0].name).toBe("products");
		expect(providers[1].name).toBe("users");
	});

	it("reports record count from array data", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["items.json"] as never);
		mockDisk.readFileSync.mockReturnValue(JSON.stringify([1, 2, 3]));

		const providers = listDataProviders("/project", deps());
		expect(providers[0].recordCount).toBe(3);
	});

	it("reports key count from object data", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["config.json"] as never);
		mockDisk.readFileSync.mockReturnValue(JSON.stringify({ a: 1, b: 2 }));

		const providers = listDataProviders("/project", deps());
		expect(providers[0].recordCount).toBe(2);
	});

	it("reports hasDictionary based on md file existence", () => {
		mockDisk.existsSync.mockImplementation((p: string) => !String(p).endsWith(".md"));
		mockDisk.readdirSync.mockReturnValue(["data.json"] as never);
		mockDisk.readFileSync.mockReturnValue("[]");

		const providers = listDataProviders("/project", deps());
		expect(providers[0].hasDictionary).toBe(false);
	});
});

describe("readDataProvider", () => {
	it("returns parsed JSON when file exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(JSON.stringify([{ id: 1 }]));
		expect(readDataProvider("/project", "users", deps())).toEqual([{ id: 1 }]);
	});

	it("returns null when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(readDataProvider("/project", "users", deps())).toBeNull();
	});

	it("returns null on parse error", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("not json");
		expect(readDataProvider("/project", "users", deps())).toBeNull();
	});
});

describe("inferSchema", () => {
	it("infers schema from array of objects", () => {
		const data = [{ id: 1, name: "Test", active: true }];
		const schema = inferSchema(data);
		expect(schema).toHaveLength(3);
		expect(schema[0]).toEqual({ field: "id", type: "number", example: "1", nullable: false });
		expect(schema[1]).toEqual({ field: "name", type: "string", example: "Test", nullable: false });
		expect(schema[2]).toEqual({ field: "active", type: "boolean", example: "true", nullable: false });
	});

	it("infers schema from single object", () => {
		const schema = inferSchema({ key: "value" });
		expect(schema).toHaveLength(1);
		expect(schema[0].field).toBe("key");
	});

	it("detects nullable fields", () => {
		const schema = inferSchema([{ optional: null }]);
		expect(schema[0].nullable).toBe(true);
	});

	it("returns empty schema for non-object data", () => {
		expect(inferSchema("hello")).toEqual([]);
		expect(inferSchema(null)).toEqual([]);
	});

	it("truncates long string examples", () => {
		const schema = inferSchema([{ desc: "A".repeat(50) }]);
		expect(schema[0].example.length).toBeLessThanOrEqual(40);
		expect(schema[0].example).toContain("...");
	});
});

describe("createDataProvider", () => {
	it("creates json and md files", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createDataProvider("/project", "user-accounts", deps());
		expect(result).not.toBeNull();
		expect(result!.jsonPath).toContain("user-accounts.json");
		expect(result!.mdPath).toContain("user-accounts.md");
		expect(mockDisk.writeFileSync).toHaveBeenCalledTimes(2);
	});

	it("returns null when provider already exists", () => {
		mockDisk.existsSync.mockImplementation((p: string) => String(p).endsWith(".json"));

		const result = createDataProvider("/project", "existing", deps());
		expect(result).toBeNull();
	});

	it("creates providers directory", () => {
		mockDisk.existsSync.mockReturnValue(false);
		createDataProvider("/project", "test", deps());
		expect(mockDisk.mkdirSync).toHaveBeenCalled();
	});
});

describe("generateDataDictionary", () => {
	it("generates markdown with schema table", () => {
		const data = [{ id: 1, name: "Test" }];
		const md = generateDataDictionary("users", data);

		expect(md).toContain("# users");
		expect(md).toContain("## Schema");
		expect(md).toContain("| id |");
		expect(md).toContain("| name |");
		expect(md).toContain("## Usage");
		expect(md).toContain("usersData");
	});

	it("includes frontmatter", () => {
		const md = generateDataDictionary("test", [{ a: 1 }]);
		expect(md).toContain("type: data-provider");
		expect(md).toContain("name: test");
	});

	it("reports record count", () => {
		const md = generateDataDictionary("items", [1, 2, 3]);
		expect(md).toContain("3 record(s)");
	});
});

describe("regenerateDataDictionary", () => {
	it("regenerates md from existing json", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(JSON.stringify([{ id: 1 }]));

		const ok = regenerateDataDictionary("/project", "users", deps());
		expect(ok).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
	});

	it("returns false when json does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(regenerateDataDictionary("/project", "missing", deps())).toBe(false);
	});
});
