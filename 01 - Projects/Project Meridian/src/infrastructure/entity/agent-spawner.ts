import type { Logger } from '../../domain/core/logger.js';
import { AgentSchema } from '../../domain/schemas/agent-schema.js';
import { AgentActor } from './agent-actor.js';
import type { MoodConfig } from '../../domain/systems/mood.js';

export interface VaultReader {
	list(path: string): Promise<string[]>;
	read(path: string): Promise<string>;
}

export interface SpawnResult {
	agents: AgentActor[];
	errors: { file: string; message: string }[];
}

export function createAgentSpawner(
	logger: Logger,
	moodConfig: MoodConfig,
): { spawnFromVault(vault: VaultReader, agentsPath: string): Promise<SpawnResult> } {
	return {
		async spawnFromVault(vault: VaultReader, agentsPath: string): Promise<SpawnResult> {
			const agents: AgentActor[] = [];
			const errors: { file: string; message: string }[] = [];

			const files = await vault.list(agentsPath);

			for (const file of files) {
				try {
					const content = await vault.read(file);
					const parsed: unknown = JSON.parse(content);
					const agent = AgentSchema.parse(parsed);
					agents.push(new AgentActor(agent, moodConfig));
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					logger.warn('AgentSpawner', `Failed to spawn agent from ${file}: ${message}`);
					errors.push({ file, message });
				}
			}

			logger.info('AgentSpawner', `Spawned ${String(agents.length)} agents, ${String(errors.length)} errors`);
			return { agents, errors };
		},
	};
}
