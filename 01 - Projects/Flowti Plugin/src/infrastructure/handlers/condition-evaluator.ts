import type { PluginHandlerRegistry, ConditionContext } from "./plugin-handler-registry";

/**
 * Evaluates boolean condition expressions over registered condition handlers.
 *
 * Grammar:
 *   expression := or_expr
 *   or_expr    := and_expr ("||" and_expr)*
 *   and_expr   := unary ("&&" unary)*
 *   unary      := "!" unary | atom
 *   atom       := "(" expression ")" | handler_id
 *   handler_id := [a-zA-Z0-9_:-]+
 *
 * Unknown handler IDs evaluate to false (safe default — item stays visible).
 */
export class ConditionEvaluator {
	constructor(private registry: PluginHandlerRegistry) {}

	evaluate(expression: string, ctx: ConditionContext): boolean {
		const trimmed = expression.trim();
		if (!trimmed) return false;

		const tokens = this.tokenize(trimmed);
		if (tokens.length === 0) return false;

		const parser = new Parser(tokens, this.registry, ctx);
		return parser.parseOr();
	}

	private tokenize(input: string): string[] {
		const tokens: string[] = [];
		let i = 0;
		while (i < input.length) {
			if (input[i] === " " || input[i] === "\t") {
				i++;
				continue;
			}
			if (input[i] === "(" || input[i] === ")") {
				tokens.push(input[i]);
				i++;
				continue;
			}
			if (input[i] === "!") {
				tokens.push("!");
				i++;
				continue;
			}
			if (input[i] === "&" && input[i + 1] === "&") {
				tokens.push("&&");
				i += 2;
				continue;
			}
			if (input[i] === "|" && input[i + 1] === "|") {
				tokens.push("||");
				i += 2;
				continue;
			}
			// Handler ID: [a-zA-Z0-9_:-]
			let id = "";
			while (i < input.length && /[a-zA-Z0-9_:-]/.test(input[i])) {
				id += input[i];
				i++;
			}
			if (id) tokens.push(id);
		}
		return tokens;
	}
}

class Parser {
	private pos = 0;

	constructor(
		private tokens: string[],
		private registry: PluginHandlerRegistry,
		private ctx: ConditionContext,
	) {}

	parseOr(): boolean {
		let left = this.parseAnd();
		while (this.peek() === "||") {
			this.consume();
			const right = this.parseAnd();
			left = left || right;
		}
		return left;
	}

	private parseAnd(): boolean {
		let left = this.parseUnary();
		while (this.peek() === "&&") {
			this.consume();
			const right = this.parseUnary();
			left = left && right;
		}
		return left;
	}

	private parseUnary(): boolean {
		if (this.peek() === "!") {
			this.consume();
			return !this.parseUnary();
		}
		return this.parseAtom();
	}

	private parseAtom(): boolean {
		if (this.peek() === "(") {
			this.consume(); // (
			const result = this.parseOr();
			this.consume(); // )
			return result;
		}
		// Handler ID
		const id = this.consume();
		if (!id) return false;
		const handler = this.registry.getCondition(id);
		if (!handler) return false;
		return handler(this.ctx);
	}

	private peek(): string | undefined {
		return this.tokens[this.pos];
	}

	private consume(): string | undefined {
		return this.tokens[this.pos++];
	}
}
