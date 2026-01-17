import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			obsidian: "./tests/mocks/obsidian-stub.ts",
			"src/main": "./tests/mocks/main-stub.ts",
		},
	},
	test: {
		include: ["tests/**/*.{test,spec}.{ts,tsx,js,jsx}"],
		exclude: ["node_modules", "dist", "docs"],
		reporters: [
			"default",
			[
				"html",
				{
					outputFile: "docs/tests/index.html",
				},
			],
		],
		coverage: {
			provider: "v8",
			reportsDirectory: "docs/tests/coverage",
			reporter: ["text", "html", "json"],
			exclude: ["tests/**"],
		},
	},
});
