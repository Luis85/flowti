import { defineConfig } from "vitest/config";

export default defineConfig({
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
	},
});
