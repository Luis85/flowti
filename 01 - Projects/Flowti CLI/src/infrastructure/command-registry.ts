/**
 * command-registry.ts — Typed command registry with collision detection.
 *
 * Each domain registers its commands with metadata (domain name,
 * project-free flags). The registry detects key collisions at
 * registration time and derives the project-free set automatically.
 */

import type { CommandHandler } from "./types.js";

export interface CommandMeta {
	handler: CommandHandler;
	domain: string;
	projectFree: boolean;
}

export interface DomainRegistration {
	domain: string;
	commands: Record<string, CommandHandler>;
	projectFree?: string[];
}

export class CommandRegistry {
	private readonly entries = new Map<string, CommandMeta>();
	private wildcardHandler: CommandHandler | undefined;
	private wildcardDomain: string | undefined;

	registerDomain(reg: DomainRegistration): void {
		const projectFreeSet = new Set(reg.projectFree ?? []);
		for (const [key, handler] of Object.entries(reg.commands)) {
			if (this.entries.has(key)) {
				const existing = this.entries.get(key)!;
				throw new Error(
					`Command "${key}" collision: registered by "${existing.domain}" and "${reg.domain}"`,
				);
			}
			this.entries.set(key, {
				handler,
				domain: reg.domain,
				projectFree: projectFreeSet.has(key),
			});
		}
	}

	setWildcard(domain: string, handler: CommandHandler): void {
		this.wildcardHandler = handler;
		this.wildcardDomain = domain;
	}

	/** Plain handler map for resolveCommand(). */
	get handlers(): Record<string, CommandHandler> {
		const result: Record<string, CommandHandler> = {};
		for (const [key, meta] of this.entries) {
			result[key] = meta.handler;
		}
		return result;
	}

	/** Derived project-free set for resolveCommand(). */
	get projectFreeSet(): Set<string> {
		const set = new Set<string>();
		for (const [key, meta] of this.entries) {
			if (meta.projectFree) set.add(key);
		}
		return set;
	}

	get wildcard(): CommandHandler | undefined {
		return this.wildcardHandler;
	}

	has(command: string): boolean {
		return this.entries.has(command);
	}

	get(command: string): CommandMeta | undefined {
		return this.entries.get(command);
	}

	/** Total number of registered commands. */
	get size(): number {
		return this.entries.size;
	}

	/** All registered command keys. */
	keys(): string[] {
		return Array.from(this.entries.keys());
	}

	/** All registered domains (unique, ordered by first registration). */
	domains(): string[] {
		const seen = new Set<string>();
		for (const meta of this.entries.values()) {
			seen.add(meta.domain);
		}
		if (this.wildcardDomain) seen.add(this.wildcardDomain);
		return Array.from(seen);
	}
}
