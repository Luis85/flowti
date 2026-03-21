import path from "node:path";
import { fileURLToPath } from "node:url";
import parser from "@typescript-eslint/parser";
import plugin from "@typescript-eslint/eslint-plugin";

const cliRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export default [
	{
		files: ["src/**/*.ts", "tests/**/*.ts"],
		languageOptions: {
			parser,
			parserOptions: {
				project: path.join(cliRoot, "configs/tsconfig.json"),
				tsconfigRootDir: cliRoot,
			},
		},
		plugins: { "@typescript-eslint": plugin },
		rules: {
			...plugin.configs.recommended.rules,
		},
	},
];
