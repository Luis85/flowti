import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: ["tests/mocks/obsidian-stub.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
			include: ["src/**/*.ts"],
		},
	},
});
