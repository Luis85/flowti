/**
 * docs-cli-surface-command.ts — `docs:cli-surface` handler (dynamic import avoids cycle with register-builtin-domains).
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { CommandRegistry } from "../infrastructure/command-registry.js";
import { generateCliSurfaceMarkdown } from "./generate-cli-surface-md.js";
import { proc } from "../infrastructure/proc.js";
import { renderSuccess, type SuccessModel } from "../ui/renderers/common-renderers.js";

export const docsCliSurfaceCommand: CommandHandler = adaptDescriptor<Record<string, unknown>, SuccessModel>({
	flags: {
		out: { type: "string", default: "docs/cli-command-surface.md", hint: "Output path (absolute or relative to cwd)" },
	},
	handler: async (ctx) => {
		const { registerBuiltinDomains } = await import("./register-builtin-domains.js");
		const { disk, paths: pathUtil } = ctx.deps;
		const outRaw = (ctx.flags.out as string) || "docs/cli-command-surface.md";
		const target = pathUtil.isAbsolute(outRaw) ? outRaw : pathUtil.join(proc.cwd(), outRaw);
		const dir = pathUtil.dirname(target);
		if (!disk.existsSync(dir)) {
			disk.mkdirSync(dir, { recursive: true });
		}
		const reg = new CommandRegistry();
		registerBuiltinDomains(reg);
		const md = generateCliSurfaceMarkdown(reg);
		disk.writeFileSync(target, md, "utf-8");
		return { message: `CLI surface written to ${target}` };
	},
	renderer: renderSuccess,
});
