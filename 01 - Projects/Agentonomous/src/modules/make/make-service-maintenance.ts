import type { ModulePorts } from '../../domain/shared/module.js';
import { err, ok, type Result } from '../../domain/shared/result.js';
import { serializeTypeSchema } from '../../domain/make/type-schema-codec.js';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { MakeSettings } from './make-settings.js';
import type { MakeError } from '../../domain/make/errors.js';
import { generateBaseYaml } from '../../domain/make/base-file.js';
import type { MakeService } from './make-service.js';

export type MaintenanceServiceMethods = Pick<MakeService, 'deleteCorruptFile' | 'regenerateBaseFile' | 'getKpis'>;

export interface MaintenanceOpsPeers {
	loadType: (typeId: string) => Promise<Result<TypeSchema, MakeError>>;
}

export function createMaintenanceOps(
	ports: ModulePorts,
	getSettings: () => MakeSettings,
	peers: MaintenanceOpsPeers,
): MaintenanceServiceMethods {
	async function deleteCorruptFile(path: string): Promise<Result<void, MakeError>> {
		const r = await ports.vault.delete(path);
		return r.kind === 'err' ? err({ kind: 'vault-error', cause: String(r.error) }) : ok(undefined);
	}

	async function regenerateBaseFile(
		typeId: string,
		options: { force?: boolean } = {},
	): Promise<Result<string, MakeError>> {
		const current = await peers.loadType(typeId);
		if (current.kind === 'err') return current;
		const schema = current.value;
		const basesFolder = getSettings().basesFolder.replace(/\/$/, '');
		const path = `${basesFolder}/${schema.id}.base`;
		const yaml = generateBaseYaml(schema);
		// User-edit check (skipped when force: true).
		if (options.force !== true) {
			const existsAtPath = await ports.vault.exists(path);
			if (existsAtPath) {
				const read = await ports.vault.read(path);
				if (read.kind === 'ok' && read.value.content !== yaml) {
					return err({ kind: 'base-generation-failed', cause: 'user-edited' });
				}
			}
		}
		// Write (exists → update, else → create).
		const existsFinal = await ports.vault.exists(path);
		const writeResult = existsFinal
			? await ports.vault.update(path, yaml)
			: await ports.vault.create(path, yaml);
		if (writeResult.kind === 'err') return err({ kind: 'vault-error', cause: writeResult.error });
		// Stamp schema.baseFile.generatedAt.
		const now = new Date().toISOString();
		const stamped: TypeSchema = { ...schema, baseFile: { path, generatedAt: now } };
		const typesFolder = getSettings().typesFolder.replace(/\/$/, '');
		const writeStamp = await ports.vault.update(`${typesFolder}/${schema.id}.json`, serializeTypeSchema(stamped));
		if (writeStamp.kind === 'err') return err({ kind: 'vault-error', cause: writeStamp.error });
		ports.eventBus.emit('make:base-regenerated', { typeId: schema.id, basePath: path });
		return ok(path);
	}

	return {
		deleteCorruptFile,
		regenerateBaseFile,
		getKpis: () => Promise.resolve({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] }),
	};
}
