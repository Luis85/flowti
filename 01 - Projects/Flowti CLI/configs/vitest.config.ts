import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		root: path.resolve(import.meta.dirname, ".."),
		include: ["tests/**/*.test.ts"],
		globals: true,
		coverage: {
			provider: "v8",
			reportsDirectory: "docs/reports/coverage",
			reporter: ["json", "text"],
			include: ["src/**/*.ts"],
			exclude: ["src/vendor.d.ts"],
		},
	},
});
